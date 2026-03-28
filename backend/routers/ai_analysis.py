import datetime
import os
from typing import Optional

import anthropic
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal

router = APIRouter(prefix="/reviews", tags=["ai-analysis"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_user(x_user_email: Optional[str] = Header(None)) -> str:
    if not x_user_email:
        raise HTTPException(status_code=401, detail="X-User-Email header is required")
    return x_user_email


class AIAnalysisOut(BaseModel):
    analysis: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


@router.get("/weekly/{week_start_date}/analysis", response_model=AIAnalysisOut)
def get_analysis(
    week_start_date: str,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    try:
        date = datetime.date.fromisoformat(week_start_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    record = (
        db.query(models.WeeklyAIAnalysis)
        .filter_by(user_id=user_email, week_start_date=date)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return record


@router.post("/weekly/{week_start_date}/analysis/generate", response_model=AIAnalysisOut)
def generate_analysis(
    week_start_date: str,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    try:
        week_start = datetime.date.fromisoformat(week_start_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # 既に生成済みなら 409
    existing = (
        db.query(models.WeeklyAIAnalysis)
        .filter_by(user_id=user_email, week_start_date=week_start)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Analysis already exists for this week")

    week_end = week_start + datetime.timedelta(days=6)

    # 今週のKPTアイテムを取得
    review = (
        db.query(models.WeeklyReview)
        .filter_by(user_id=user_email, week_start_date=week_start)
        .first()
    )
    keep_items: list[str] = []
    problem_items: list[str] = []
    try_items: list[str] = []
    if review:
        keep_items = [i.content for i in review.kpt_items if i.type == "keep"]
        problem_items = [i.content for i in review.kpt_items if i.type == "problem"]
        try_items = [i.content for i in review.kpt_items if i.type == "try"]

    # 先週のTryアイテムを取得
    prev_week_start = week_start - datetime.timedelta(days=7)
    prev_review = (
        db.query(models.WeeklyReview)
        .filter_by(user_id=user_email, week_start_date=prev_week_start)
        .first()
    )
    prev_try_items: list[tuple[str, bool]] = []
    if prev_review:
        prev_try_items = [
            (i.content, i.is_completed)
            for i in prev_review.kpt_items
            if i.type == "try"
        ]

    # 今週の習慣達成率を計算
    logs = (
        db.query(models.DailyLog)
        .filter(
            models.DailyLog.date >= week_start,
            models.DailyLog.date <= week_end,
            models.DailyLog.is_deleted == False,  # noqa: E712
        )
        .all()
    )
    total = len(logs)
    checked = sum(1 for log in logs if log.is_checked)
    rate = round(checked / total * 100) if total > 0 else 0

    # プロンプト組み立て
    keep_text = "\n".join(f"・{c}" for c in keep_items) if keep_items else "（なし）"
    problem_text = "\n".join(f"・{c}" for c in problem_items) if problem_items else "（なし）"
    try_text = "\n".join(f"・{c}" for c in try_items) if try_items else "（なし）"
    prev_try_text = (
        "\n".join(
            f"・{c} {'（達成）' if done else '（未達成）'}"
            for c, done in prev_try_items
        )
        if prev_try_items
        else "（なし）"
    )

    week_start_str = week_start.strftime("%Y/%m/%d")
    week_end_str = week_end.strftime("%Y/%m/%d")

    user_message = f"""以下は今週（{week_start_str}〜{week_end_str}）の振り返りデータです。

【今週の達成率】{rate}%

【Keep】{keep_text}

【Problem】{problem_text}

【Try】{try_text}

【先週のTry】{prev_try_text}

以下を簡潔に教えてください（各項目2〜3行以内）:
1. 今週の良かった点
2. 課題の改善ヒント
3. Tryへのアドバイス
4. 来週への一言
"""

    # Claude API呼び出し
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1500,
        system="""あなたはAtomic Habitsの専門家として、ユーザーの週次振り返りを分析するコーチです。
簡潔で実践的なフィードバックを日本語で提供してください。
テーブル形式は使わず、箇条書きと短い文章で回答してください。
全体で400文字以内に収めてください。""",
        messages=[{"role": "user", "content": user_message}],
    )

    analysis_text = message.content[0].text

    # DBに保存
    record = models.WeeklyAIAnalysis(
        user_id=user_email,
        week_start_date=week_start,
        analysis=analysis_text,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

import calendar
import datetime
import os
from typing import Optional

import anthropic
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal
from domain.value_objects import WeekPeriod, YearMonth
from services.domain.achievement_service import (
    MonthlyAchievementService,
    WeeklyAchievementService,
)

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
        keep_items = [i.content for i in review.kpt_items if i.type == "keep"][:3]
        problem_items = [i.content for i in review.kpt_items if i.type == "problem"][:3]
        try_items = [i.content for i in review.kpt_items if i.type == "try"][:3]

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
        ][:3]

    # 今週の習慣達成率・最弱・最強習慣を取得
    weekly_service = WeeklyAchievementService(db)
    week_period = WeekPeriod(week_start)
    weekly_stats = weekly_service.get_weekly_stats(week_period)
    rate = weekly_stats["achievement_rate"]
    weakest_habit = weekly_stats.get("weakest_habit")
    strongest_habit = weekly_stats.get("strongest_habit")

    # プロンプト組み立て（XMLタグで構造化・優先度順）
    from services.weekly_stats import get_achievement_rate_vs_last_week
    vs_last_week = get_achievement_rate_vs_last_week(week_start, rate, db)

    nl = chr(10)
    week_start_str = week_start.strftime("%Y/%m/%d")
    week_end_str = week_end.strftime("%Y/%m/%d")

    context = f"""<weekly_analysis_context>
  <achievement>
    <rate>{rate}%</rate>
    <vs_last_week>{vs_last_week or "データなし"}</vs_last_week>
    <weakest_habit>{weakest_habit or "なし"}</weakest_habit>
    <strongest_habit>{strongest_habit or "なし"}</strongest_habit>
  </achievement>
  <kpt>
    <problem>{nl.join(f"- {i}" for i in problem_items) or "なし"}</problem>
    <try>{nl.join(f"- {i}" for i in try_items) or "なし"}</try>
    <keep>{nl.join(f"- {i}" for i in keep_items) or "なし"}</keep>
  </kpt>
  <last_week_try>
    {nl.join(f"- {c}（{'達成' if done else '未達成'}）" for c, done in prev_try_items) or "なし"}
  </last_week_try>
</weekly_analysis_context>"""

    user_message = f"""以下は今週（{week_start_str}〜{week_end_str}）の振り返りデータです。

{context}

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
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
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


# ---- Monthly AI Analysis ----

@router.get("/monthly/{year_month}/analysis", response_model=AIAnalysisOut)
def get_monthly_analysis(
    year_month: str,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    try:
        YearMonth.from_string(year_month)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid year_month format. Use YYYY-MM")

    record = (
        db.query(models.MonthlyAIAnalysis)
        .filter_by(user_id=user_email, year_month=year_month)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return record


@router.post("/monthly/{year_month}/analysis/generate", response_model=AIAnalysisOut)
def generate_monthly_analysis(
    year_month: str,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    try:
        ym_obj = YearMonth.from_string(year_month)
        year, month = ym_obj.year, ym_obj.month
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid year_month format. Use YYYY-MM")

    # 既に生成済みなら 409
    existing = (
        db.query(models.MonthlyAIAnalysis)
        .filter_by(user_id=user_email, year_month=year_month)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Analysis already exists for this month")

    first_day = datetime.date(year, month, 1)
    last_day = datetime.date(year, month, calendar.monthrange(year, month)[1])
    today = datetime.date.today()

    # 月内のDailyLogsを取得
    logs = (
        db.query(models.DailyLog)
        .filter(
            models.DailyLog.date >= first_day,
            models.DailyLog.date <= last_day,
            models.DailyLog.is_deleted == False,  # noqa: E712
        )
        .all()
    )

    # MonthlyAchievementServiceで集計
    monthly_service = MonthlyAchievementService(db)
    stats = monthly_service.build_monthly_stats(year, month, logs, today)

    overall_rate = stats["overall_rate"]
    current_streak = stats["current_streak"]
    streak_max = stats["streak_max"]
    total_days_checked = stats["total_days_checked"]
    weekly_rates = stats["weekly_rates"]
    low_achievement_count = stats["low_achievement_count"]
    low_achievement_weekday = stats["low_achievement_weekday"]

    # 低達成日の傾向テキスト
    if low_achievement_count == 0:
        low_achievement_text = "なし"
    elif low_achievement_weekday:
        low_achievement_text = f"{low_achievement_count}日（{low_achievement_weekday}曜日が多い傾向）"
    else:
        low_achievement_text = f"{low_achievement_count}日"

    # プロンプト組み立て（XMLタグで構造化・優先度順）
    nl = chr(10)
    context = f"""<monthly_analysis_context>
  <achievement>
    <overall_rate>{overall_rate}%</overall_rate>
    <total_days_checked>{total_days_checked}日</total_days_checked>
    <streak_max>{streak_max}日</streak_max>
    <streak_current>{current_streak}日</streak_current>
  </achievement>
  <weekly_breakdown>
    {nl.join(f"- {w['week_start']}週: {w['rate']}%" for w in weekly_rates) or "なし"}
  </weekly_breakdown>
  <low_achievement>
    {low_achievement_text}
  </low_achievement>
</monthly_analysis_context>"""

    user_message = f"""以下は{year_month}の習慣達成データです。

{context}

以下を簡潔に教えてください（各項目2〜3行以内）:
1. 今月の達成率への評価
2. 達成率が低い時期・曜日のパターンと改善ヒント
3. 連続達成日数へのフィードバック
4. 来月に向けての一言
"""

    # Claude API呼び出し
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        system="""あなたはAtomic Habitsの専門家として、ユーザーの月次習慣データを分析するコーチです。
簡潔で実践的なフィードバックを日本語で提供してください。
テーブル形式は使わず、箇条書きと短い文章で回答してください。
全体で400文字以内に収めてください。""",
        messages=[{"role": "user", "content": user_message}],
    )

    analysis_text = message.content[0].text

    # DBに保存
    record = models.MonthlyAIAnalysis(
        user_id=user_email,
        year_month=year_month,
        analysis=analysis_text,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

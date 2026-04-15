import datetime
import json
import os
from typing import List, Optional

import anthropic
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal

router = APIRouter(prefix="/coaching", tags=["coaching"])


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


# ---- Pydantic Schemas ----

class CoachingMessageOut(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class CoachingSessionSummaryOut(BaseModel):
    id: int
    session_date: str
    status: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class CoachingSessionOut(BaseModel):
    id: int
    session_date: str
    status: str
    context: Optional[str]
    created_at: datetime.datetime
    updated_at: datetime.datetime
    messages: List[CoachingMessageOut] = []

    class Config:
        from_attributes = True


class CoachingGoalOut(BaseModel):
    id: int
    title: str
    due_date: Optional[str]
    status: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True


class SendMessageRequest(BaseModel):
    content: str


class CreateGoalRequest(BaseModel):
    title: str
    due_date: Optional[str] = None


class UpdateGoalRequest(BaseModel):
    title: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None


# ---- Constants ----

SYSTEM_PROMPT_TEMPLATE = """あなたはプロのライフコーチです。認知科学コーチングの原則に基づき、以下を厳守してください。

【絶対に守るルール】
1. 答え・アドバイス・解決策を与えない
2. 1回のメッセージで問いかけは必ず1つだけ
3. ユーザーの言葉をそのまま使って深掘りする
4. 判断・評価・共感の押しつけをしない
5. ユーザーの内側にある答えを引き出すことだけに集中する
6. 習慣データを参照して具体的・パーソナルな問いかけをする

【NGフレーズ】
「〇〇した方がいいと思います」
「それは△△が原因ですね」
「素晴らしいですね」（評価しない）
「大変でしたね」（共感の押しつけ）

【OKフレーズ】
「今週の達成率が{rate}%でしたね。それについてどう感じていますか？」
「『ユーザーの言葉』とおっしゃいましたが、もう少し教えてもらえますか？」
「もしその状況が変わったとしたら、何が違うと思いますか？」
「それはあなたにとってどんな意味がありますか？」

【セッションの流れ】
Step1: チェックイン（今週の状態・気持ちを聞く）
Step2: 習慣データへの気づきを深掘り
Step3: 課題・障害の探索（Problemを深掘り）
Step4: 目標・アクションの言語化（Tryを具体化）
Step5: セッションのまとめ・来週への問いかけ

現在のコンテキスト:
{context}

前回のセッション内容:
{previous_session}"""


# ---- Helper Functions ----

def get_current_week_saturday() -> datetime.date:
    today = datetime.date.today()
    # Week: Sunday to Saturday. Sunday=0 in (weekday()+1)%7
    days_since_sunday = (today.weekday() + 1) % 7
    week_start_sunday = today - datetime.timedelta(days=days_since_sunday)
    return week_start_sunday + datetime.timedelta(days=6)


def build_context_str(context_data: dict) -> str:
    rate = context_data.get("achievement_rate", 0)
    kpt = context_data.get("kpt", {})
    prev_try = context_data.get("prev_try_items", [])
    goals = context_data.get("active_goals", [])
    week_start = context_data.get("week_start", "")
    week_end = context_data.get("week_end", "")

    lines = [
        f"【今週】{week_start} 〜 {week_end}",
        f"【今週の習慣達成率】{rate}%",
    ]
    if kpt.get("keep"):
        lines.append("【Keep】" + "、".join(kpt["keep"]))
    if kpt.get("problem"):
        lines.append("【Problem】" + "、".join(kpt["problem"]))
    if kpt.get("try"):
        lines.append("【Try（今週の目標）】" + "、".join(kpt["try"]))
    if prev_try:
        parts = [f"{i['content']}（{'達成' if i['is_completed'] else '未達成'}）" for i in prev_try]
        lines.append("【先週のTry】" + "、".join(parts))
    else:
        lines.append("【先週のTry】なし")
    if goals:
        lines.append("【アクティブなゴール】" + "、".join(g["title"] for g in goals))
    else:
        lines.append("【アクティブなゴール】なし")
    return "\n".join(lines)


def build_prev_session_str(messages: list) -> str:
    if not messages:
        return "（前回のセッションなし）"
    lines = []
    for m in messages:
        label = "コーチ" if m["role"] == "assistant" else "ユーザー"
        lines.append(f"{label}: {m['content']}")
    return "\n".join(lines)


def gather_context(user_email: str, db: Session) -> dict:
    today = datetime.date.today()
    days_since_sunday = (today.weekday() + 1) % 7
    week_start = today - datetime.timedelta(days=days_since_sunday)
    week_end = week_start + datetime.timedelta(days=6)

    review = db.query(models.WeeklyReview).filter_by(user_id=user_email, week_start_date=week_start).first()
    kpt_data: dict = {"keep": [], "problem": [], "try": []}
    if review:
        for item in review.kpt_items:
            kpt_data[item.type].append(item.content)

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
    achievement_rate = round(checked / total * 100) if total > 0 else 0

    prev_week_start = week_start - datetime.timedelta(days=7)
    prev_review = db.query(models.WeeklyReview).filter_by(user_id=user_email, week_start_date=prev_week_start).first()
    prev_try_items: list = []
    if prev_review:
        prev_try_items = [
            {"content": i.content, "is_completed": i.is_completed}
            for i in prev_review.kpt_items if i.type == "try"
        ]

    active_goals = db.query(models.CoachingGoal).filter_by(user_id=user_email, status="active").all()
    goals_data = [{"id": g.id, "title": g.title, "due_date": g.due_date} for g in active_goals]

    return {
        "achievement_rate": achievement_rate,
        "kpt": kpt_data,
        "prev_try_items": prev_try_items,
        "active_goals": goals_data,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
    }


def get_previous_session_messages(user_email: str, db: Session) -> list:
    prev_session = (
        db.query(models.CoachingSession)
        .filter_by(user_id=user_email, status="completed")
        .order_by(models.CoachingSession.created_at.desc())
        .first()
    )
    if not prev_session:
        return []
    return [
        {"role": m.role, "content": m.content}
        for m in prev_session.messages
    ]


def build_system_prompt(context_data: dict, prev_messages: list) -> str:
    context_str = build_context_str(context_data)
    prev_session_str = build_prev_session_str(prev_messages)
    return (
        SYSTEM_PROMPT_TEMPLATE
        .replace("{context}", context_str)
        .replace("{previous_session}", prev_session_str)
    )


def call_claude(system: str, messages: list) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1500,
        system=system,
        messages=messages,
    )
    return response.content[0].text


# ---- Endpoints ----

@router.get("/sessions", response_model=List[CoachingSessionSummaryOut])
def list_sessions(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    sessions = (
        db.query(models.CoachingSession)
        .filter_by(user_id=user_email)
        .order_by(models.CoachingSession.created_at.desc())
        .all()
    )
    return sessions


@router.get("/sessions/current", response_model=CoachingSessionOut)
def get_current_session(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    saturday = get_current_week_saturday()
    session = (
        db.query(models.CoachingSession)
        .filter_by(user_id=user_email, session_date=saturday.isoformat())
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="No session for current week")
    return session


@router.get("/sessions/{session_id}", response_model=CoachingSessionOut)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    session = db.query(models.CoachingSession).filter_by(id=session_id, user_id=user_email).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions", response_model=CoachingSessionOut)
def create_session(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    saturday = get_current_week_saturday()

    existing = (
        db.query(models.CoachingSession)
        .filter_by(user_id=user_email, session_date=saturday.isoformat())
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Session already exists for this week")

    context_data = gather_context(user_email, db)
    prev_messages = get_previous_session_messages(user_email, db)

    session = models.CoachingSession(
        user_id=user_email,
        session_date=saturday.isoformat(),
        status="in_progress",
        context=json.dumps(context_data, ensure_ascii=False),
    )
    db.add(session)
    db.flush()

    # Generate first message
    system = build_system_prompt(context_data, prev_messages)
    rate = context_data["achievement_rate"]
    prev_try = context_data.get("prev_try_items", [])

    if prev_messages:
        first_prompt = "新しいコーチングセッションを開始してください。前回のセッションを踏まえて、今週のチェックインの問いかけを1つ生成してください。"
    elif prev_try:
        first_try = prev_try[0]["content"]
        first_prompt = f"新しいコーチングセッションを開始してください。先週「{first_try}」というTryを設定していたことを踏まえて、チェックインの問いかけを1つ生成してください。"
    elif rate >= 70:
        first_prompt = f"新しいコーチングセッションを開始してください。今週の習慣達成率は{rate}%でした。この結果を踏まえたチェックインの問いかけを1つ生成してください。"
    else:
        first_prompt = f"新しいコーチングセッションを開始してください。今週の習慣達成率は{rate}%でした。今の気持ちへのチェックインの問いかけを1つ生成してください。"

    first_content = call_claude(system, [{"role": "user", "content": first_prompt}])

    first_msg = models.CoachingMessage(
        session_id=session.id,
        role="assistant",
        content=first_content,
    )
    db.add(first_msg)
    db.commit()
    db.refresh(session)
    return session


@router.post("/sessions/{session_id}/messages", response_model=CoachingMessageOut)
def send_message(
    session_id: int,
    body: SendMessageRequest,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    session = db.query(models.CoachingSession).filter_by(id=session_id, user_id=user_email).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Session is already completed")

    # Save user message
    user_msg = models.CoachingMessage(
        session_id=session_id,
        role="user",
        content=body.content,
    )
    db.add(user_msg)
    db.flush()

    # Build conversation including the just-added user message
    all_msgs = (
        db.query(models.CoachingMessage)
        .filter_by(session_id=session_id)
        .order_by(models.CoachingMessage.created_at)
        .all()
    )
    conversation = [{"role": m.role, "content": m.content} for m in all_msgs]

    # Build system and generate response
    context_data = json.loads(session.context) if session.context else {}
    prev_messages = get_previous_session_messages(user_email, db)
    system = build_system_prompt(context_data, prev_messages)
    ai_content = call_claude(system, conversation)

    ai_msg = models.CoachingMessage(
        session_id=session_id,
        role="assistant",
        content=ai_content,
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)
    return ai_msg


@router.post("/sessions/{session_id}/complete", response_model=CoachingSessionOut)
def complete_session(
    session_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    session = db.query(models.CoachingSession).filter_by(id=session_id, user_id=user_email).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Session is already completed")

    # Build conversation history
    all_msgs = (
        db.query(models.CoachingMessage)
        .filter_by(session_id=session_id)
        .order_by(models.CoachingMessage.created_at)
        .all()
    )
    conversation = [{"role": m.role, "content": m.content} for m in all_msgs]

    context_data = json.loads(session.context) if session.context else {}
    prev_messages = get_previous_session_messages(user_email, db)
    system = build_system_prompt(context_data, prev_messages)

    summary_prompt = """セッションが完了しました。以下の形式でまとめを作成してください:

【今日の気づき】
（セッションで出てきた気づきを箇条書き）

【宣言したこと】
（セッションで出てきたアクション・目標）

【来週への問い】
（来週のセッションまでに考えておく問いかけを1つ）"""

    summary_messages = conversation + [{"role": "user", "content": summary_prompt}]
    summary_content = call_claude(system, summary_messages)

    summary_msg = models.CoachingMessage(
        session_id=session_id,
        role="assistant",
        content=summary_content,
    )
    db.add(summary_msg)
    session.status = "completed"
    db.commit()
    db.refresh(session)
    return session


@router.get("/goals", response_model=List[CoachingGoalOut])
def list_goals(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    goals = (
        db.query(models.CoachingGoal)
        .filter_by(user_id=user_email, status="active")
        .order_by(models.CoachingGoal.created_at.desc())
        .all()
    )
    return goals


@router.post("/goals", response_model=CoachingGoalOut)
def create_goal(
    body: CreateGoalRequest,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    goal = models.CoachingGoal(
        user_id=user_email,
        title=body.title,
        due_date=body.due_date,
        status="active",
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.put("/goals/{goal_id}", response_model=CoachingGoalOut)
def update_goal(
    goal_id: int,
    body: UpdateGoalRequest,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    goal = db.query(models.CoachingGoal).filter_by(id=goal_id, user_id=user_email).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if body.title is not None:
        goal.title = body.title
    if body.due_date is not None:
        goal.due_date = body.due_date
    if body.status is not None:
        goal.status = body.status
    db.commit()
    db.refresh(goal)
    return goal

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
from domain.enums import GoalStatus, SessionStatus
from domain.exceptions import InvalidStateTransitionError
from domain.value_objects import WeekPeriod
from services.coaching_context import build_coaching_context, build_message_context, build_system_prompt

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


# ---- Helper Functions ----

def get_current_week_saturday() -> datetime.date:
    return WeekPeriod.current().end


def call_claude(system: str, messages: list, max_tokens: int = 500) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=max_tokens,
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

    context_data = build_coaching_context(user_email, db)

    session = models.CoachingSession(
        user_id=user_email,
        session_date=saturday.isoformat(),
        status=SessionStatus.IN_PROGRESS,
        context=json.dumps(context_data, ensure_ascii=False),
    )
    db.add(session)
    db.flush()

    system = build_system_prompt(context_data)
    rate = context_data["achievement"]["this_week_rate"]
    prev_try = context_data.get("prev_try_items", [])
    has_prev_summary = bool(context_data.get("prev_session_summary"))

    if has_prev_summary:
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
    try:
        user_msg = session.add_message("user", body.content)
    except InvalidStateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.add(user_msg)
    db.flush()

    all_msgs = (
        db.query(models.CoachingMessage)
        .filter_by(session_id=session_id)
        .order_by(models.CoachingMessage.created_at)
        .all()
    )
    conversation = [{"role": m.role, "content": m.content} for m in all_msgs]

    system, recent_msgs = build_message_context(session, conversation)
    ai_content = call_claude(system, recent_msgs)

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
    all_msgs = (
        db.query(models.CoachingMessage)
        .filter_by(session_id=session_id)
        .order_by(models.CoachingMessage.created_at)
        .all()
    )
    conversation = [{"role": m.role, "content": m.content} for m in all_msgs]

    context_data = json.loads(session.context) if session.context else {}
    system = build_system_prompt(context_data)

    summary_prompt = """セッションが完了しました。以下の形式でまとめを作成してください:

【今日の気づき】
（セッションで出てきた気づきを箇条書き）

【宣言したこと】
（セッションで出てきたアクション・目標）

【来週への問い】
（来週のセッションまでに考えておく問いかけを1つ）"""

    summary_messages = conversation + [{"role": "user", "content": summary_prompt}]
    summary_content = call_claude(system, summary_messages, max_tokens=800)

    summary_msg = models.CoachingMessage(
        session_id=session_id,
        role="assistant",
        content=summary_content,
    )
    db.add(summary_msg)
    try:
        session.complete(summary_content)
    except InvalidStateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))
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
        .filter_by(user_id=user_email, status=GoalStatus.ACTIVE)
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
        status=GoalStatus.ACTIVE,
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

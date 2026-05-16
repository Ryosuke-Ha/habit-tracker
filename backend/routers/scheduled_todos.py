import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal

_JST = datetime.timezone(datetime.timedelta(hours=9))

router = APIRouter(prefix="/scheduled-todos", tags=["scheduled-todos"])


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


def _today_jst() -> datetime.date:
    return datetime.datetime.now(_JST).date()


# ---- Pydantic schemas ----

class ScheduledTodoOut(BaseModel):
    id: int
    user_id: str
    title: str
    scheduled_date: datetime.date
    scheduled_time: Optional[str]
    location: Optional[str]
    is_completed: bool
    completed_at: Optional[datetime.datetime]
    created_at: datetime.datetime
    updated_at: datetime.datetime
    notification_offset_1: Optional[str] = None
    notification_offset_2: Optional[str] = None
    notification_sent_1: bool = False
    notification_sent_2: bool = False

    class Config:
        from_attributes = True


class ScheduledTodoWithCategoryOut(BaseModel):
    """ScheduledTodoOut with API-layer computed display category fields."""
    id: int
    user_id: str
    title: str
    scheduled_date: datetime.date
    scheduled_time: Optional[str]
    location: Optional[str]
    is_completed: bool
    completed_at: Optional[datetime.datetime]
    created_at: datetime.datetime
    updated_at: datetime.datetime
    notification_offset_1: Optional[str] = None
    notification_offset_2: Optional[str] = None
    notification_sent_1: bool = False
    notification_sent_2: bool = False
    # Computed by API layer
    is_overdue: bool
    is_today: bool
    is_future: bool
    days_until: int
    display_category: str  # "overdue" | "today" | "future" | "past"


class ScheduledTodoCreate(BaseModel):
    title: str
    scheduled_date: datetime.date
    scheduled_time: Optional[str] = None
    location: Optional[str] = ""
    notification_offset_1: Optional[str] = None
    notification_offset_2: Optional[str] = None


class ScheduledTodoUpdate(BaseModel):
    title: Optional[str] = None
    scheduled_date: Optional[datetime.date] = None
    scheduled_time: Optional[str] = None
    location: Optional[str] = None
    notification_offset_1: Optional[str] = None
    notification_offset_2: Optional[str] = None


# ---- Helpers ----

def _enrich(todo: models.ScheduledTodo, today: datetime.date) -> dict:
    """Build a ScheduledTodoWithCategoryOut-compatible dict from an ORM object."""
    days_until = (todo.scheduled_date - today).days
    is_today = days_until == 0
    is_future = days_until > 0
    is_overdue = days_until < 0 and not todo.is_completed

    if is_overdue:
        display_category = "overdue"
    elif is_today:
        display_category = "today"
    elif is_future:
        display_category = "future"
    else:
        # past date + completed
        display_category = "past"

    return {
        "id": todo.id,
        "user_id": todo.user_id,
        "title": todo.title,
        "scheduled_date": todo.scheduled_date,
        "scheduled_time": todo.scheduled_time,
        "location": todo.location,
        "is_completed": todo.is_completed,
        "completed_at": todo.completed_at,
        "created_at": todo.created_at,
        "updated_at": todo.updated_at,
        "notification_offset_1": todo.notification_offset_1,
        "notification_offset_2": todo.notification_offset_2,
        "notification_sent_1": todo.notification_sent_1,
        "notification_sent_2": todo.notification_sent_2,
        "is_overdue": is_overdue,
        "is_today": is_today,
        "is_future": is_future,
        "days_until": days_until,
        "display_category": display_category,
    }


# ---- Endpoints ----

@router.get("", response_model=List[ScheduledTodoWithCategoryOut])
def list_scheduled_todos(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    today = _today_jst()
    todos = (
        db.query(models.ScheduledTodo)
        .filter(models.ScheduledTodo.user_id == user_email)
        .all()
    )
    enriched = [_enrich(t, today) for t in todos]

    overdue = sorted(
        [t for t in enriched if t["display_category"] == "overdue"],
        key=lambda t: t["scheduled_date"],
        reverse=True,
    )
    today_todos = sorted(
        [t for t in enriched if t["display_category"] == "today"],
        key=lambda t: t["scheduled_time"] or "",
    )
    future = sorted(
        [t for t in enriched if t["display_category"] == "future"],
        key=lambda t: (t["scheduled_date"], t["scheduled_time"] or ""),
    )
    past = sorted(
        [t for t in enriched if t["display_category"] == "past"],
        key=lambda t: t["scheduled_date"],
        reverse=True,
    )

    return overdue + today_todos + future + past


@router.get("/today", response_model=List[ScheduledTodoWithCategoryOut])
def list_today_scheduled_todos(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    today = _today_jst()
    todos = (
        db.query(models.ScheduledTodo)
        .filter(
            models.ScheduledTodo.user_id == user_email,
            models.ScheduledTodo.scheduled_date == today,
        )
        .order_by(models.ScheduledTodo.scheduled_time)
        .all()
    )
    return [_enrich(t, today) for t in todos]


@router.post("", response_model=ScheduledTodoWithCategoryOut)
def create_scheduled_todo(
    body: ScheduledTodoCreate,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    todo = models.ScheduledTodo(
        user_id=user_email,
        title=body.title,
        scheduled_date=body.scheduled_date,
        scheduled_time=body.scheduled_time,
        location=body.location or "",
        notification_offset_1=body.notification_offset_1,
        notification_offset_2=body.notification_offset_2,
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return _enrich(todo, _today_jst())


@router.put("/{todo_id}", response_model=ScheduledTodoWithCategoryOut)
def update_scheduled_todo(
    todo_id: int,
    body: ScheduledTodoUpdate,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    todo = db.query(models.ScheduledTodo).filter_by(id=todo_id, user_id=user_email).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Not found")
    if body.title is not None:
        todo.title = body.title
    if body.scheduled_date is not None:
        todo.scheduled_date = body.scheduled_date
    if body.scheduled_time is not None:
        todo.scheduled_time = body.scheduled_time
    if body.location is not None:
        todo.location = body.location
    if body.notification_offset_1 is not None or "notification_offset_1" in body.model_fields_set:
        todo.notification_offset_1 = body.notification_offset_1
        todo.notification_sent_1 = False
    if body.notification_offset_2 is not None or "notification_offset_2" in body.model_fields_set:
        todo.notification_offset_2 = body.notification_offset_2
        todo.notification_sent_2 = False
    todo.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(todo)
    return _enrich(todo, _today_jst())


@router.post("/{todo_id}/complete", response_model=ScheduledTodoWithCategoryOut)
def complete_scheduled_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    todo = db.query(models.ScheduledTodo).filter_by(id=todo_id, user_id=user_email).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Not found")
    todo.is_completed = True
    todo.completed_at = datetime.datetime.utcnow()
    todo.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(todo)
    return _enrich(todo, _today_jst())


@router.post("/{todo_id}/toggle", response_model=ScheduledTodoWithCategoryOut)
def toggle_scheduled_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    todo = db.query(models.ScheduledTodo).filter_by(id=todo_id, user_id=user_email).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Not found")
    todo.is_completed = not todo.is_completed
    todo.completed_at = datetime.datetime.utcnow() if todo.is_completed else None
    todo.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(todo)
    return _enrich(todo, _today_jst())


@router.delete("/{todo_id}", status_code=204)
def delete_scheduled_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    todo = db.query(models.ScheduledTodo).filter_by(id=todo_id, user_id=user_email).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(todo)
    db.commit()

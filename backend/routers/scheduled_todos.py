import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

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

    class Config:
        from_attributes = True


class ScheduledTodoCreate(BaseModel):
    title: str
    scheduled_date: datetime.date
    scheduled_time: Optional[str] = None
    location: Optional[str] = ""


class ScheduledTodoUpdate(BaseModel):
    title: Optional[str] = None
    scheduled_date: Optional[datetime.date] = None
    scheduled_time: Optional[str] = None
    location: Optional[str] = None


@router.get("", response_model=List[ScheduledTodoOut])
def list_scheduled_todos(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    return (
        db.query(models.ScheduledTodo)
        .filter(models.ScheduledTodo.user_id == user_email)
        .order_by(models.ScheduledTodo.scheduled_date, models.ScheduledTodo.scheduled_time)
        .all()
    )


@router.get("/today", response_model=List[ScheduledTodoOut])
def list_today_scheduled_todos(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    today = datetime.datetime.now(ZoneInfo("Asia/Tokyo")).date()
    return (
        db.query(models.ScheduledTodo)
        .filter(
            models.ScheduledTodo.user_id == user_email,
            models.ScheduledTodo.scheduled_date == today,
        )
        .order_by(models.ScheduledTodo.scheduled_time)
        .all()
    )


@router.post("", response_model=ScheduledTodoOut)
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
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


@router.put("/{todo_id}", response_model=ScheduledTodoOut)
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
    todo.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(todo)
    return todo


@router.post("/{todo_id}/complete", response_model=ScheduledTodoOut)
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
    return todo


@router.post("/{todo_id}/toggle", response_model=ScheduledTodoOut)
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
    return todo


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

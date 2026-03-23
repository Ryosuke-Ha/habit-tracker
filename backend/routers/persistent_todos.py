import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal

router = APIRouter(prefix="/persistent-todos", tags=["persistent-todos"])


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


class PersistentTodoOut(BaseModel):
    id: int
    user_id: str
    title: str
    scheduled_time: Optional[str]
    location: Optional[str]
    is_completed: bool
    completed_at: Optional[datetime.datetime]
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class PersistentTodoCreate(BaseModel):
    title: str
    scheduled_time: Optional[str] = None
    location: Optional[str] = ""


class PersistentTodoUpdate(BaseModel):
    title: Optional[str] = None
    scheduled_time: Optional[str] = None
    location: Optional[str] = None


@router.get("", response_model=List[PersistentTodoOut])
def list_persistent_todos(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    return (
        db.query(models.PersistentTodo)
        .filter(
            models.PersistentTodo.user_id == user_email,
            models.PersistentTodo.is_completed == False,  # noqa: E712
        )
        .order_by(models.PersistentTodo.created_at)
        .all()
    )


@router.post("", response_model=PersistentTodoOut)
def create_persistent_todo(
    body: PersistentTodoCreate,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    todo = models.PersistentTodo(
        user_id=user_email,
        title=body.title,
        scheduled_time=body.scheduled_time,
        location=body.location or "",
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


@router.put("/{todo_id}", response_model=PersistentTodoOut)
def update_persistent_todo(
    todo_id: int,
    body: PersistentTodoUpdate,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    todo = db.query(models.PersistentTodo).filter_by(id=todo_id, user_id=user_email).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Not found")
    if body.title is not None:
        todo.title = body.title
    if body.scheduled_time is not None:
        todo.scheduled_time = body.scheduled_time
    if body.location is not None:
        todo.location = body.location
    db.commit()
    db.refresh(todo)
    return todo


@router.post("/{todo_id}/complete", response_model=PersistentTodoOut)
def toggle_complete_persistent_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    todo = db.query(models.PersistentTodo).filter_by(id=todo_id, user_id=user_email).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Not found")
    todo.is_completed = not todo.is_completed
    todo.completed_at = datetime.datetime.utcnow() if todo.is_completed else None
    db.commit()
    db.refresh(todo)
    return todo


@router.delete("/{todo_id}", status_code=204)
def delete_persistent_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    todo = db.query(models.PersistentTodo).filter_by(id=todo_id, user_id=user_email).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(todo)
    db.commit()

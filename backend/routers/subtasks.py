import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal

router = APIRouter(prefix="/subtasks", tags=["subtasks"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class SubTaskOut(BaseModel):
    id: int
    todo_type: str
    todo_id: int
    title: str
    is_completed: bool
    order: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class SubTaskCreate(BaseModel):
    todo_type: str
    todo_id: int
    title: str


class SubTaskUpdate(BaseModel):
    title: str


@router.get("", response_model=List[SubTaskOut])
def list_subtasks(
    todo_type: str = Query(...),
    todo_id: int = Query(...),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.SubTask)
        .filter_by(todo_type=todo_type, todo_id=todo_id)
        .order_by(models.SubTask.order, models.SubTask.created_at)
        .all()
    )


@router.post("", response_model=SubTaskOut)
def create_subtask(
    body: SubTaskCreate,
    db: Session = Depends(get_db),
):
    max_order = (
        db.query(models.SubTask)
        .filter_by(todo_type=body.todo_type, todo_id=body.todo_id)
        .count()
    )
    subtask = models.SubTask(
        todo_type=body.todo_type,
        todo_id=body.todo_id,
        title=body.title,
        order=max_order,
    )
    db.add(subtask)
    db.commit()
    db.refresh(subtask)
    return subtask


@router.put("/{subtask_id}", response_model=SubTaskOut)
def update_subtask(
    subtask_id: int,
    body: SubTaskUpdate,
    db: Session = Depends(get_db),
):
    subtask = db.query(models.SubTask).filter_by(id=subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Not found")
    subtask.title = body.title
    db.commit()
    db.refresh(subtask)
    return subtask


@router.post("/{subtask_id}/toggle", response_model=SubTaskOut)
def toggle_subtask(
    subtask_id: int,
    db: Session = Depends(get_db),
):
    subtask = db.query(models.SubTask).filter_by(id=subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Not found")
    subtask.is_completed = not subtask.is_completed
    db.commit()
    db.refresh(subtask)
    return subtask


@router.delete("/{subtask_id}", status_code=204)
def delete_subtask(
    subtask_id: int,
    db: Session = Depends(get_db),
):
    subtask = db.query(models.SubTask).filter_by(id=subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(subtask)
    db.commit()

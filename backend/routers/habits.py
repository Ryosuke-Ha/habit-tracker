import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter()


class HabitCreate(BaseModel):
    template_id: int
    title: str
    scheduled_time: str
    location: str = ""


class HabitUpdate(BaseModel):
    title: str
    scheduled_time: str
    location: str = ""


class HabitResponse(BaseModel):
    id: int
    template_id: int
    title: str
    scheduled_time: str
    location: str
    order: int

    class Config:
        from_attributes = True


class LogResponse(BaseModel):
    id: int
    habit_id: int
    is_checked: bool

    class Config:
        from_attributes = True


@router.post("/habits", response_model=HabitResponse)
def create_habit(habit: HabitCreate, db: Session = Depends(get_db)):
    template = db.query(models.Template).filter(models.Template.id == habit.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    max_order = (
        db.query(models.Habit)
        .filter(models.Habit.template_id == habit.template_id)
        .count()
    )
    db_habit = models.Habit(
        template_id=habit.template_id,
        title=habit.title,
        scheduled_time=habit.scheduled_time,
        location=habit.location,
        order=max_order,
    )
    db.add(db_habit)
    db.commit()
    db.refresh(db_habit)
    return db_habit


@router.put("/habits/{habit_id}", response_model=HabitResponse)
def update_habit(habit_id: int, habit: HabitUpdate, db: Session = Depends(get_db)):
    db_habit = db.query(models.Habit).filter(models.Habit.id == habit_id).first()
    if not db_habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    db_habit.title = habit.title
    db_habit.scheduled_time = habit.scheduled_time
    db_habit.location = habit.location
    db.commit()
    db.refresh(db_habit)
    return db_habit


@router.delete("/habits/{habit_id}")
def delete_habit(habit_id: int, db: Session = Depends(get_db)):
    habit = db.query(models.Habit).filter(models.Habit.id == habit_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    db.delete(habit)
    db.commit()
    return {"ok": True}


@router.get("/logs/today", response_model=list[LogResponse])
def get_today_logs(template_id: int, db: Session = Depends(get_db)):
    today = datetime.date.today()
    habits = (
        db.query(models.Habit)
        .filter(models.Habit.template_id == template_id)
        .all()
    )
    habit_ids = [h.id for h in habits]

    existing = {
        log.habit_id: log
        for log in db.query(models.DailyLog)
        .filter(
            models.DailyLog.habit_id.in_(habit_ids),
            models.DailyLog.date == today,
        )
        .all()
    }

    result = []
    for habit in habits:
        if habit.id not in existing:
            log = models.DailyLog(habit_id=habit.id, date=today, is_checked=False)
            db.add(log)
            db.flush()
            existing[habit.id] = log
        result.append(existing[habit.id])

    db.commit()
    return result


@router.post("/logs/{habit_id}/toggle", response_model=LogResponse)
def toggle_log(habit_id: int, db: Session = Depends(get_db)):
    habit = db.query(models.Habit).filter(models.Habit.id == habit_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    today = datetime.date.today()
    log = (
        db.query(models.DailyLog)
        .filter(
            models.DailyLog.habit_id == habit_id,
            models.DailyLog.date == today,
        )
        .first()
    )

    if log:
        log.is_checked = not log.is_checked
    else:
        log = models.DailyLog(habit_id=habit_id, date=today, is_checked=True)
        db.add(log)

    db.commit()
    db.refresh(log)
    return log

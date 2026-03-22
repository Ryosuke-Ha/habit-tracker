import datetime
from typing import Optional

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
    habit_id: Optional[int]
    title: str
    scheduled_time: str
    location: str
    is_checked: bool
    order: int = 0


class StandaloneLogCreate(BaseModel):
    template_id: int
    title: str
    scheduled_time: str
    location: str = ""


class StandaloneLogUpdate(BaseModel):
    title: str
    scheduled_time: str
    location: str = ""


def _build_log_response(log: models.DailyLog, habit: Optional[models.Habit] = None, order: int = 0) -> LogResponse:
    """Build a LogResponse from a DailyLog, resolving title/time/location from habit or standalone fields."""
    if habit is not None:
        return LogResponse(
            id=log.id,
            habit_id=habit.id,
            title=habit.title,
            scheduled_time=habit.scheduled_time,
            location=habit.location,
            is_checked=log.is_checked,
            order=order,
        )
    return LogResponse(
        id=log.id,
        habit_id=None,
        title=log.title or "",
        scheduled_time=log.scheduled_time or "00:00",
        location=log.location or "",
        is_checked=log.is_checked,
        order=999,
    )


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

    # Detach existing DailyLogs: copy habit data to standalone fields, nullify habit_id
    logs = db.query(models.DailyLog).filter(models.DailyLog.habit_id == habit_id).all()
    for log in logs:
        log.title = habit.title
        log.scheduled_time = habit.scheduled_time
        log.location = habit.location
        log.template_id = habit.template_id
        log.habit_id = None
    db.flush()

    db.delete(habit)
    db.commit()
    return {"ok": True}


@router.get("/logs/today", response_model=list[LogResponse])
def get_today_logs(template_id: int, db: Session = Depends(get_db)):
    today = datetime.date.today()
    habits = (
        db.query(models.Habit)
        .filter(models.Habit.template_id == template_id)
        .order_by(models.Habit.scheduled_time)
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
        if log.habit_id is not None
    }

    result = []
    for i, habit in enumerate(habits):
        if habit.id not in existing:
            log = models.DailyLog(habit_id=habit.id, date=today, is_checked=False)
            db.add(log)
            db.flush()
            existing[habit.id] = log
        result.append(_build_log_response(existing[habit.id], habit=habit, order=i))

    # Include standalone logs for today belonging to this template
    standalone_logs = (
        db.query(models.DailyLog)
        .filter(
            models.DailyLog.habit_id.is_(None),
            models.DailyLog.date == today,
            models.DailyLog.template_id == template_id,
        )
        .all()
    )
    for log in standalone_logs:
        result.append(_build_log_response(log))

    db.commit()
    return result


@router.post("/logs/standalone", response_model=LogResponse)
def create_standalone_log(body: StandaloneLogCreate, db: Session = Depends(get_db)):
    today = datetime.date.today()
    log = models.DailyLog(
        habit_id=None,
        date=today,
        is_checked=False,
        title=body.title,
        scheduled_time=body.scheduled_time,
        location=body.location,
        template_id=body.template_id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return _build_log_response(log)


@router.put("/logs/standalone/{log_id}", response_model=LogResponse)
def update_standalone_log(log_id: int, body: StandaloneLogUpdate, db: Session = Depends(get_db)):
    log = db.query(models.DailyLog).filter(
        models.DailyLog.id == log_id,
        models.DailyLog.habit_id.is_(None),
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Standalone log not found")
    log.title = body.title
    log.scheduled_time = body.scheduled_time
    log.location = body.location
    db.commit()
    db.refresh(log)
    return _build_log_response(log)


@router.delete("/logs/{log_id}")
def delete_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(models.DailyLog).filter(models.DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    db.delete(log)
    db.commit()
    return {"ok": True}


@router.post("/logs/{log_id}/toggle", response_model=LogResponse)
def toggle_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(models.DailyLog).filter(models.DailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    log.is_checked = not log.is_checked
    db.commit()
    db.refresh(log)

    if log.habit_id is not None:
        habit = db.query(models.Habit).filter(models.Habit.id == log.habit_id).first()
        return _build_log_response(log, habit=habit)
    return _build_log_response(log)

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from auth import verify_api_key
from database import get_db
from utils.cache import get_cached, invalidate_cache, set_cached

router = APIRouter(dependencies=[Depends(verify_api_key)])


class TemplateResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


PROTECTED_TEMPLATE_NAMES = {"平日", "休日"}


class TemplateWithStatsOut(BaseModel):
    """TemplateResponse with API-layer computed habit count and default flag."""
    id: int
    name: str
    habit_count: int
    is_default: bool


class HabitResponse(BaseModel):
    id: int
    template_id: int
    title: str
    scheduled_time: str
    location: str
    order: int

    class Config:
        from_attributes = True


class TemplateCreate(BaseModel):
    name: str


class TemplateUpdate(BaseModel):
    name: str


@router.get("/templates", response_model=list[TemplateWithStatsOut])
def get_templates(db: Session = Depends(get_db)):
    cache_key = "templates"
    cached = get_cached(cache_key)
    if cached:
        return cached

    templates = db.query(models.Template).all()
    habit_counts = dict(
        db.query(models.Habit.template_id, func.count(models.Habit.id))
        .group_by(models.Habit.template_id)
        .all()
    )
    result = [
        {
            "id": t.id,
            "name": t.name,
            "habit_count": habit_counts.get(t.id, 0),
            "is_default": t.name in PROTECTED_TEMPLATE_NAMES,
        }
        for t in templates
    ]
    set_cached(cache_key, result, ttl_seconds=600)
    return result


@router.post("/templates", response_model=TemplateResponse)
def create_template(body: TemplateCreate, db: Session = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    existing = db.query(models.Template).filter(models.Template.name == body.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Template name already exists")
    template = models.Template(name=body.name.strip())
    db.add(template)
    db.commit()
    db.refresh(template)
    invalidate_cache("templates")
    return template


@router.put("/templates/{template_id}", response_model=TemplateResponse)
def update_template(template_id: int, body: TemplateUpdate, db: Session = Depends(get_db)):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    template.name = body.name.strip()
    db.commit()
    db.refresh(template)
    invalidate_cache("templates")
    return template


@router.delete("/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.name in PROTECTED_TEMPLATE_NAMES:
        raise HTTPException(status_code=403, detail=f"Template '{template.name}' cannot be deleted")
    db.delete(template)
    db.commit()
    invalidate_cache("templates")
    return {"ok": True}


@router.get("/templates/{template_id}/habits", response_model=list[HabitResponse])
def get_habits_by_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    habits = (
        db.query(models.Habit)
        .filter(models.Habit.template_id == template_id)
        .order_by(models.Habit.scheduled_time)
        .all()
    )
    return habits

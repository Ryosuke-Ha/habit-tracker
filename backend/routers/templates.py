from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter()


class TemplateResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


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


@router.get("/templates", response_model=list[TemplateResponse])
def get_templates(db: Session = Depends(get_db)):
    return db.query(models.Template).all()


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
    return template


@router.delete("/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(models.Template).filter(models.Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()
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

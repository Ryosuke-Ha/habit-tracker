import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal

router = APIRouter(prefix="/reviews", tags=["reviews"])


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


def get_week_start(date: datetime.date) -> datetime.date:
    """Return the Sunday that starts the week containing `date`."""
    days_since_sunday = (date.weekday() + 1) % 7
    return date - datetime.timedelta(days=days_since_sunday)


def get_or_create_review(
    db: Session, user_email: str, week_start: datetime.date
) -> models.WeeklyReview:
    review = (
        db.query(models.WeeklyReview)
        .filter_by(user_id=user_email, week_start_date=week_start)
        .first()
    )
    if not review:
        review = models.WeeklyReview(user_id=user_email, week_start_date=week_start)
        db.add(review)
        db.commit()
        db.refresh(review)
    return review


# ---- Pydantic schemas ----

class KPTItemOut(BaseModel):
    id: int
    review_id: int
    type: str
    content: str
    is_completed: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class WeeklyReviewOut(BaseModel):
    id: int
    user_id: str
    week_start_date: datetime.date
    created_at: datetime.datetime
    updated_at: datetime.datetime
    kpt_items: List[KPTItemOut] = []

    class Config:
        from_attributes = True


class KPTItemCreate(BaseModel):
    type: str   # "keep" | "problem" | "try"
    content: str


class KPTItemUpdate(BaseModel):
    content: Optional[str] = None
    is_completed: Optional[bool] = None


# ---- Routes (specific paths before parameterized) ----

@router.get("/weekly/current/try-items", response_model=List[KPTItemOut])
def get_current_try_items(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    """Return Try items for last week.
    - 404: last week's review does not exist yet
    - 200 + []: review exists but has no Try items
    - 200 + [...]: review exists with Try items
    """
    today = datetime.date.today()
    this_week_start = get_week_start(today)
    last_week_start = this_week_start - datetime.timedelta(days=7)
    review = (
        db.query(models.WeeklyReview)
        .filter_by(user_id=user_email, week_start_date=last_week_start)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Last week's review not found")
    return [item for item in review.kpt_items if item.type == "try"]


@router.get("/weekly/current", response_model=WeeklyReviewOut)
def get_current_review(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    today = datetime.date.today()
    week_start = get_week_start(today)
    return get_or_create_review(db, user_email, week_start)


@router.get("/weekly", response_model=List[WeeklyReviewOut])
def list_reviews(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    return (
        db.query(models.WeeklyReview)
        .filter_by(user_id=user_email)
        .order_by(models.WeeklyReview.week_start_date.desc())
        .all()
    )


@router.get("/weekly/{week_start_date}", response_model=WeeklyReviewOut)
def get_review_by_date(
    week_start_date: str,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    try:
        date = datetime.date.fromisoformat(week_start_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    week_start = get_week_start(date)
    return get_or_create_review(db, user_email, week_start)


@router.post("/weekly/{review_id}/kpt", response_model=KPTItemOut)
def add_kpt_item(
    review_id: int,
    body: KPTItemCreate,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    review = db.query(models.WeeklyReview).filter_by(id=review_id, user_id=user_email).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if body.type not in ("keep", "problem", "try"):
        raise HTTPException(status_code=400, detail="type must be keep, problem, or try")
    item = models.KPTItem(review_id=review_id, type=body.type, content=body.content)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/kpt/{item_id}", response_model=KPTItemOut)
def update_kpt_item(
    item_id: int,
    body: KPTItemUpdate,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    item = (
        db.query(models.KPTItem)
        .join(models.WeeklyReview)
        .filter(models.KPTItem.id == item_id, models.WeeklyReview.user_id == user_email)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if body.content is not None:
        item.content = body.content
    if body.is_completed is not None:
        item.is_completed = body.is_completed
    db.commit()
    db.refresh(item)
    return item


@router.delete("/kpt/{item_id}", status_code=204)
def delete_kpt_item(
    item_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    item = (
        db.query(models.KPTItem)
        .join(models.WeeklyReview)
        .filter(models.KPTItem.id == item_id, models.WeeklyReview.user_id == user_email)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()

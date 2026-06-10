import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from auth import verify_api_key
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal
from domain.enums import KPTType
from domain.exceptions import AggregateNotFoundError, BusinessRuleViolationError
from domain.value_objects import WeekPeriod
from repositories.weekly_review_repository import WeeklyReviewRepository
from services.weekly_stats import (
    get_achievement_rate_vs_last_week,
    get_last_week_try_completion,
    get_weekly_stats,
)

router = APIRouter(prefix="/reviews", tags=["reviews"], dependencies=[Depends(verify_api_key)])


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


def get_or_create_review(
    db: Session, user_email: str, week_start: datetime.date
) -> models.WeeklyReview:
    repo = WeeklyReviewRepository(db)
    review = repo.find_by_user_and_week(user_email, week_start)
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


class WeeklyReviewWithStatsOut(BaseModel):
    """WeeklyReview with API-layer computed achievement stats."""
    id: int
    user_id: str
    week_start_date: datetime.date
    created_at: datetime.datetime
    updated_at: datetime.datetime
    kpt_items: List[KPTItemOut] = []
    # Computed by API layer
    achievement_rate: Optional[int] = None
    achievement_rate_vs_last_week: Optional[str] = None
    checked_habits: Optional[int] = None
    total_habits: Optional[int] = None
    weakest_habit: Optional[str] = None
    strongest_habit: Optional[str] = None
    last_week_try_completion: Optional[str] = None


class KPTItemCreate(BaseModel):
    type: str   # "keep" | "problem" | "try"
    content: str


class KPTItemUpdate(BaseModel):
    content: Optional[str] = None
    is_completed: Optional[bool] = None


# ---- Helper ----

def _build_review_with_stats(
    review: models.WeeklyReview,
    db: Session,
) -> dict:
    """Build a WeeklyReviewWithStatsOut-compatible dict from a WeeklyReview ORM object."""
    stats = get_weekly_stats(review.week_start_date, db)
    vs_last_week = get_achievement_rate_vs_last_week(
        review.week_start_date, stats["achievement_rate"], db
    )
    try_completion = get_last_week_try_completion(review.user_id, review.week_start_date, db)

    return {
        "id": review.id,
        "user_id": review.user_id,
        "week_start_date": review.week_start_date,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
        "kpt_items": [
            {
                "id": item.id,
                "review_id": item.review_id,
                "type": item.type,
                "content": item.content,
                "is_completed": item.is_completed,
                "created_at": item.created_at,
            }
            for item in review.kpt_items
        ],
        "achievement_rate": stats["achievement_rate"],
        "achievement_rate_vs_last_week": vs_last_week,
        "checked_habits": stats["checked_habits"],
        "total_habits": stats["total_habits"],
        "weakest_habit": stats["weakest_habit"],
        "strongest_habit": stats["strongest_habit"],
        "last_week_try_completion": try_completion,
    }


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
    this_week_start = WeekPeriod.current().start
    last_week_start = this_week_start - datetime.timedelta(days=7)
    review = (
        db.query(models.WeeklyReview)
        .filter_by(user_id=user_email, week_start_date=last_week_start)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Last week's review not found")
    return [item for item in review.kpt_items if item.type == KPTType.TRY]


@router.get("/weekly/current", response_model=WeeklyReviewWithStatsOut)
def get_current_review(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    week_start = WeekPeriod.current().start
    review = get_or_create_review(db, user_email, week_start)
    return _build_review_with_stats(review, db)


@router.get("/weekly", response_model=List[WeeklyReviewOut])
def list_reviews(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    repo = WeeklyReviewRepository(db)
    return repo.find_all_by_user(user_email)


@router.get("/weekly/{week_start_date}", response_model=WeeklyReviewWithStatsOut)
def get_review_by_date(
    week_start_date: str,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    try:
        date = datetime.date.fromisoformat(week_start_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    week_start = WeekPeriod.from_date(date).start
    review = get_or_create_review(db, user_email, week_start)
    return _build_review_with_stats(review, db)


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
    if body.type not in {t.value for t in KPTType}:
        raise HTTPException(status_code=400, detail="type must be keep, problem, or try")
    try:
        item = review.add_kpt_item(KPTType(body.type), body.content)
    except BusinessRuleViolationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/weekly/{review_id}/kpt/{item_id}", response_model=KPTItemOut)
def update_kpt_item(
    review_id: int,
    item_id: int,
    body: KPTItemUpdate,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    """集約ルート（WeeklyReview）経由でKPTItemを更新する"""
    review = (
        db.query(models.WeeklyReview)
        .filter_by(id=review_id, user_id=user_email)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="WeeklyReview not found")
    try:
        item = review.find_kpt_item(item_id)
    except AggregateNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    if body.content is not None:
        item.content = body.content
    if body.is_completed is not None:
        item.is_completed = body.is_completed
    db.commit()
    db.refresh(item)
    return item


@router.delete("/weekly/{review_id}/kpt/{item_id}", status_code=204)
def delete_kpt_item(
    review_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    """集約ルート（WeeklyReview）経由でKPTItemを削除する"""
    review = (
        db.query(models.WeeklyReview)
        .filter_by(id=review_id, user_id=user_email)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="WeeklyReview not found")
    try:
        item = review.find_kpt_item(item_id)
    except AggregateNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    db.delete(item)
    db.commit()


# ---- Deprecated endpoints (backward-compatible) ----

@router.put("/kpt/{item_id}", response_model=KPTItemOut)
def update_kpt_item_deprecated(
    item_id: int,
    body: KPTItemUpdate,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    """Deprecated: Use PUT /reviews/weekly/{review_id}/kpt/{item_id} instead"""
    kpt_item = (
        db.query(models.KPTItem)
        .join(models.WeeklyReview)
        .filter(models.KPTItem.id == item_id, models.WeeklyReview.user_id == user_email)
        .first()
    )
    if not kpt_item:
        raise HTTPException(status_code=404, detail="Item not found")
    review = (
        db.query(models.WeeklyReview)
        .filter_by(id=kpt_item.review_id, user_id=user_email)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="WeeklyReview not found")
    try:
        item = review.find_kpt_item(item_id)
    except AggregateNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    if body.content is not None:
        item.content = body.content
    if body.is_completed is not None:
        item.is_completed = body.is_completed
    db.commit()
    db.refresh(item)
    return item


@router.delete("/kpt/{item_id}", status_code=204)
def delete_kpt_item_deprecated(
    item_id: int,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    """Deprecated: Use DELETE /reviews/weekly/{review_id}/kpt/{item_id} instead"""
    kpt_item = (
        db.query(models.KPTItem)
        .join(models.WeeklyReview)
        .filter(models.KPTItem.id == item_id, models.WeeklyReview.user_id == user_email)
        .first()
    )
    if not kpt_item:
        raise HTTPException(status_code=404, detail="Item not found")
    review = (
        db.query(models.WeeklyReview)
        .filter_by(id=kpt_item.review_id, user_id=user_email)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="WeeklyReview not found")
    try:
        item = review.find_kpt_item(item_id)
    except AggregateNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    db.delete(item)
    db.commit()

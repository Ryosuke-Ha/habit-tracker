import calendar
import datetime
from collections import defaultdict
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal

router = APIRouter(prefix="/reviews", tags=["monthly-reviews"])


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


def current_year_month() -> str:
    today = datetime.date.today()
    return f"{today.year}-{today.month:02d}"


def get_or_create_monthly_review(
    db: Session, user_email: str, year_month: str
) -> models.MonthlyReview:
    review = (
        db.query(models.MonthlyReview)
        .filter_by(user_id=user_email, year_month=year_month)
        .first()
    )
    if not review:
        review = models.MonthlyReview(
            user_id=user_email, year_month=year_month, next_month_goal=""
        )
        db.add(review)
        db.commit()
        db.refresh(review)
    return review


# ---- Pydantic schemas ----

class MonthlyReviewOut(BaseModel):
    id: int
    user_id: str
    year_month: str
    next_month_goal: Optional[str]
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True


class MonthlyReviewUpdate(BaseModel):
    next_month_goal: str


class DailyRate(BaseModel):
    date: str
    rate: float
    checked: int
    total: int


class WeeklyRate(BaseModel):
    week_start: str
    rate: float


class MonthlyStats(BaseModel):
    overall_rate: float
    streak: int
    daily_rates: List[DailyRate]
    weekly_rates: List[WeeklyRate]


class GoalOut(BaseModel):
    goal: str


# ---- Routes (specific before parameterized) ----

@router.get("/monthly/current/goal", response_model=GoalOut)
def get_current_goal(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    """Return last month's next_month_goal as the current month's goal (for TODO screen).
    404 if last month's review doesn't exist or goal is empty.
    """
    today = datetime.date.today()
    if today.month == 1:
        last_ym = f"{today.year - 1}-12"
    else:
        last_ym = f"{today.year}-{today.month - 1:02d}"

    review = (
        db.query(models.MonthlyReview)
        .filter_by(user_id=user_email, year_month=last_ym)
        .first()
    )
    if not review or not review.next_month_goal:
        raise HTTPException(status_code=404, detail="No goal set for this month")
    return {"goal": review.next_month_goal}


@router.get("/monthly/current", response_model=MonthlyReviewOut)
def get_current_monthly_review(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    return get_or_create_monthly_review(db, user_email, current_year_month())


@router.get("/monthly", response_model=List[MonthlyReviewOut])
def list_monthly_reviews(
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    return (
        db.query(models.MonthlyReview)
        .filter_by(user_id=user_email)
        .order_by(models.MonthlyReview.year_month.desc())
        .all()
    )


@router.get("/monthly/{year_month}/stats", response_model=MonthlyStats)
def get_monthly_stats(
    year_month: str,
    db: Session = Depends(get_db),
    _user_email: str = Depends(require_user),
):
    try:
        year, month = map(int, year_month.split("-"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid year_month format. Use YYYY-MM")

    first_day = datetime.date(year, month, 1)
    last_day = datetime.date(year, month, calendar.monthrange(year, month)[1])
    today = datetime.date.today()
    calc_until = min(last_day, today)

    # All daily logs within the month
    logs = (
        db.query(models.DailyLog)
        .filter(models.DailyLog.date >= first_day, models.DailyLog.date <= last_day)
        .all()
    )

    # Group logs by date
    date_logs: dict[datetime.date, list[models.DailyLog]] = defaultdict(list)
    for log in logs:
        date_logs[log.date].append(log)

    # Daily rates (only up to today)
    daily_rates: list[DailyRate] = []
    d = first_day
    while d <= calc_until:
        day_logs = date_logs[d]
        total = len(day_logs)
        checked = sum(1 for l in day_logs if l.is_checked)
        rate = round(checked / total, 4) if total > 0 else 0.0
        daily_rates.append(DailyRate(
            date=d.isoformat(),
            rate=rate,
            checked=checked,
            total=total,
        ))
        d += datetime.timedelta(days=1)

    # Overall rate
    total_all = sum(r.total for r in daily_rates)
    checked_all = sum(r.checked for r in daily_rates)
    overall_rate = round(checked_all / total_all, 4) if total_all > 0 else 0.0

    # Streak: consecutive days ending today (or last day of month) with ≥1 check
    streak = 0
    check_d = calc_until
    while check_d >= first_day:
        day_logs = date_logs[check_d]
        if any(l.is_checked for l in day_logs):
            streak += 1
        else:
            break
        check_d -= datetime.timedelta(days=1)

    # Weekly rates (Sun–Sat buckets within the month)
    week_buckets: dict[datetime.date, list[DailyRate]] = defaultdict(list)
    for dr in daily_rates:
        dr_date = datetime.date.fromisoformat(dr.date)
        days_since_sunday = (dr_date.weekday() + 1) % 7
        week_sun = dr_date - datetime.timedelta(days=days_since_sunday)
        week_buckets[week_sun].append(dr)

    weekly_rates: list[WeeklyRate] = []
    for week_start in sorted(week_buckets):
        bucket = week_buckets[week_start]
        w_total = sum(r.total for r in bucket)
        w_checked = sum(r.checked for r in bucket)
        weekly_rates.append(WeeklyRate(
            week_start=week_start.isoformat(),
            rate=round(w_checked / w_total, 4) if w_total > 0 else 0.0,
        ))

    return MonthlyStats(
        overall_rate=overall_rate,
        streak=streak,
        daily_rates=daily_rates,
        weekly_rates=weekly_rates,
    )


@router.get("/monthly/{year_month}", response_model=MonthlyReviewOut)
def get_monthly_review_by_month(
    year_month: str,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    # Validate format
    try:
        parts = year_month.split("-")
        if len(parts) != 2:
            raise ValueError
        datetime.date(int(parts[0]), int(parts[1]), 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid year_month format. Use YYYY-MM")
    return get_or_create_monthly_review(db, user_email, year_month)


@router.put("/monthly/{review_id}", response_model=MonthlyReviewOut)
def update_monthly_review(
    review_id: int,
    body: MonthlyReviewUpdate,
    db: Session = Depends(get_db),
    user_email: str = Depends(require_user),
):
    review = (
        db.query(models.MonthlyReview)
        .filter_by(id=review_id, user_id=user_email)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.next_month_goal = body.next_month_goal
    db.commit()
    db.refresh(review)
    return review

import datetime
from collections import defaultdict
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

import models


def get_weekly_stats(week_start: datetime.date, db: Session) -> dict:
    """Calculate weekly habit achievement stats for the given week start date.

    Note: DailyLog has no user_id column; all non-deleted logs in the date
    range are included, consistent with ai_analysis.py and coaching.py.
    """
    week_end = week_start + timedelta(days=6)

    logs = (
        db.query(models.DailyLog)
        .filter(
            models.DailyLog.date >= week_start,
            models.DailyLog.date <= week_end,
            models.DailyLog.is_deleted == False,  # noqa: E712
        )
        .all()
    )

    total = len(logs)
    checked = sum(1 for log in logs if log.is_checked)
    rate = round(checked / total * 100) if total > 0 else 0

    # Group by habit_id to find weakest/strongest (exclude standalone logs)
    habit_logs: dict = defaultdict(list)
    for log in logs:
        if log.habit_id is not None:
            habit_logs[log.habit_id].append(log)

    weakest_habit: Optional[str] = None
    strongest_habit: Optional[str] = None

    if habit_logs:
        habit_rates = {
            habit_id: sum(1 for lg in h_logs if lg.is_checked) / len(h_logs)
            for habit_id, h_logs in habit_logs.items()
        }
        weakest_id = min(habit_rates, key=lambda k: habit_rates[k])
        strongest_id = max(habit_rates, key=lambda k: habit_rates[k])

        weakest_obj = db.query(models.Habit).filter(models.Habit.id == weakest_id).first()
        strongest_obj = db.query(models.Habit).filter(models.Habit.id == strongest_id).first()

        weakest_habit = weakest_obj.title if weakest_obj else None
        strongest_habit = strongest_obj.title if strongest_obj else None

    return {
        "achievement_rate": rate,
        "checked_habits": checked,
        "total_habits": total,
        "weakest_habit": weakest_habit,
        "strongest_habit": strongest_habit,
    }


def get_achievement_rate_vs_last_week(
    week_start: datetime.date,
    current_rate: int,
    db: Session,
) -> Optional[str]:
    """Return achievement rate change vs last week as '+X%' or '-X%'.

    Returns None if last week has no habit data.
    """
    last_week_start = week_start - timedelta(days=7)
    last_stats = get_weekly_stats(last_week_start, db)
    if last_stats["total_habits"] == 0:
        return None
    diff = current_rate - last_stats["achievement_rate"]
    return f"+{diff}%" if diff >= 0 else f"{diff}%"


def get_last_week_try_completion(
    user_id: str,
    week_start: datetime.date,
    db: Session,
) -> Optional[str]:
    """Return last week's Try item completion as 'X/Y' string.

    Returns None if last week's review doesn't exist or has no Try items.
    """
    last_week_start = week_start - timedelta(days=7)
    prev_review = (
        db.query(models.WeeklyReview)
        .filter_by(user_id=user_id, week_start_date=last_week_start)
        .first()
    )
    if not prev_review:
        return None
    try_items = [i for i in prev_review.kpt_items if i.type == "try"]
    if not try_items:
        return None
    completed = sum(1 for i in try_items if i.is_completed)
    return f"{completed}/{len(try_items)}"

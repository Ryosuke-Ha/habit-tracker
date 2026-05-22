import datetime
from typing import Optional

from sqlalchemy.orm import Session

from domain.value_objects import WeekPeriod
from services.domain.achievement_service import WeeklyAchievementService


def get_weekly_stats(week_start: datetime.date, db: Session) -> dict:
    """Calculate weekly habit achievement stats for the given week start date.

    Delegates to WeeklyAchievementService.
    """
    week_period = WeekPeriod.from_date(week_start)
    service = WeeklyAchievementService(db)
    return service.get_weekly_stats(week_period)


def get_achievement_rate_vs_last_week(
    week_start: datetime.date,
    current_rate: int,
    db: Session,
) -> Optional[str]:
    """Return achievement rate change vs last week as '+X%' or '-X%'.

    Returns None if last week has no habit data.
    Delegates to WeeklyAchievementService.
    """
    week_period = WeekPeriod.from_date(week_start)
    service = WeeklyAchievementService(db)
    return service.calc_vs_last_week(week_period, current_rate)


def get_last_week_try_completion(
    user_id: str,
    week_start: datetime.date,
    db: Session,
) -> Optional[str]:
    """Return last week's Try item completion as 'X/Y' string.

    Returns None if last week's review doesn't exist or has no Try items.
    Delegates to WeeklyAchievementService.
    """
    week_period = WeekPeriod.from_date(week_start)
    service = WeeklyAchievementService(db)
    return service.calc_last_week_try_completion(user_id, week_period)

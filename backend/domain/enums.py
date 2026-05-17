from enum import Enum


class KPTType(str, Enum):
    KEEP = "keep"
    PROBLEM = "problem"
    TRY = "try"


class SessionStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class GoalStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class NotificationOffset(str, Enum):
    ON_TIME = "on_time"
    THIRTY_MIN_BEFORE = "30min_before"
    ONE_HOUR_BEFORE = "1hour_before"
    TWO_HOURS_BEFORE = "2hour_before"
    ONE_DAY_BEFORE = "1day_before"
    TWO_DAYS_BEFORE = "2day_before"


class TodoDisplayCategory(str, Enum):
    OVERDUE = "overdue"
    TODAY = "today"
    FUTURE = "future"

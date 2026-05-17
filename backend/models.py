from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database import Base
from domain.enums import GoalStatus, KPTType, SessionStatus
from domain.exceptions import (
    AggregateNotFoundError,
    BusinessRuleViolationError,
    InvalidStateTransitionError,
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    habits = relationship("Habit", back_populates="template", cascade="all, delete-orphan")


class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)
    title = Column(String, nullable=False)
    scheduled_time = Column(String, nullable=False)  # "HH:MM" format
    location = Column(String, nullable=False, default="")
    order = Column(Integer, default=0)

    template = relationship("Template", back_populates="habits")
    # Do NOT cascade-delete DailyLogs; detach them manually on Habit deletion
    logs = relationship("DailyLog", back_populates="habit", cascade="save-update, merge")


class DailyLog(Base):
    __tablename__ = "daily_logs"

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=True)  # nullable: standalone logs have no habit
    date = Column(Date, nullable=False)
    is_checked = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)  # soft-delete: prevents regeneration on reload
    # Standalone (one-off) fields — populated when habit_id is None, or used as edit override
    title = Column(String, nullable=True)
    scheduled_time = Column(String, nullable=True)
    location = Column(String, nullable=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)  # for filtering standalone logs

    habit = relationship("Habit", back_populates="logs")

    def check(self) -> None:
        """習慣を達成済みにする"""
        self.is_checked = True

    def uncheck(self) -> None:
        """習慣を未達成に戻す"""
        self.is_checked = False

    def toggle(self) -> None:
        """達成状態を切り替える"""
        self.is_checked = not self.is_checked

    @property
    def is_accomplished(self) -> bool:
        """is_checkedのドメイン用エイリアス（より意味が明確）"""
        return self.is_checked


class WeeklyReview(Base):
    __tablename__ = "weekly_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)  # MVP: user email
    week_start_date = Column(Date, nullable=False)        # 必ず日曜日
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    kpt_items = relationship("KPTItem", back_populates="review", cascade="all, delete-orphan")

    def add_kpt_item(self, kpt_type: KPTType, content: str) -> "KPTItem":
        """
        KPTアイテムを追加する（集約ルート経由）
        """
        if not content or not content.strip():
            raise BusinessRuleViolationError("KPTの内容は必須です")
        return KPTItem(
            review_id=self.id,
            type=kpt_type,
            content=content.strip()
        )

    def find_kpt_item(self, item_id: int) -> "KPTItem":
        """
        このレビューに属するKPTItemを取得する
        集約境界の保護: 他のレビューのアイテムは取得できない
        """
        item = next(
            (i for i in self.kpt_items if i.id == item_id),
            None
        )
        if item is None:
            raise AggregateNotFoundError(
                f"KPTItem {item_id} はこのWeeklyReviewに属しません"
            )
        return item

    def get_items_by_type(self, kpt_type: KPTType) -> list:
        """種別でKPTアイテムを取得"""
        return [i for i in self.kpt_items if i.type == kpt_type]


class MonthlyReview(Base):
    __tablename__ = "monthly_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    year_month = Column(String, nullable=False)          # "YYYY-MM"
    next_month_goal = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PersistentTodo(Base):
    __tablename__ = "persistent_todos"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    scheduled_time = Column(String, nullable=True)
    location = Column(String, nullable=True, default="")
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SubTask(Base):
    __tablename__ = "subtasks"

    id = Column(Integer, primary_key=True, index=True)
    todo_type = Column(String, nullable=False)   # "habit_log" | "persistent_todo"
    todo_id = Column(Integer, nullable=False, index=True)
    title = Column(String, nullable=False)
    is_completed = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    key = Column(String, nullable=False)
    value = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KPTItem(Base):
    __tablename__ = "kpt_items"

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("weekly_reviews.id"), nullable=False)
    type = Column(String, nullable=False)       # "keep" | "problem" | "try"
    content = Column(String, nullable=False)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    review = relationship("WeeklyReview", back_populates="kpt_items")


class ScheduledTodo(Base):
    __tablename__ = "scheduled_todos"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    scheduled_date = Column(Date, nullable=False)
    scheduled_time = Column(String, nullable=True)
    location = Column(String, nullable=True, default="")
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notification_offset_1 = Column(String, nullable=True)
    notification_offset_2 = Column(String, nullable=True)
    notification_sent_1 = Column(Boolean, default=False)
    notification_sent_2 = Column(Boolean, default=False)


class WeeklyAIAnalysis(Base):
    __tablename__ = "weekly_ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    week_start_date = Column(Date, nullable=False)
    analysis = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class MonthlyAIAnalysis(Base):
    __tablename__ = "monthly_ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    year_month = Column(String, nullable=False)   # "YYYY-MM"
    analysis = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class CoachingSession(Base):
    __tablename__ = "coaching_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    session_date = Column(String, nullable=False)  # YYYY-MM-DD (this week's Saturday)
    status = Column(String, nullable=False, default="in_progress")  # "in_progress" | "completed"
    context = Column(String, nullable=True)  # JSON string
    summary = Column(String, nullable=True)  # Generated on completion; used as context for next session
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("CoachingMessage", back_populates="session", cascade="all, delete-orphan", order_by="CoachingMessage.created_at")

    def complete(self, summary: str) -> None:
        """
        セッションを完了させる。
        既に完了済みの場合はInvalidStateTransitionErrorを発生させる。
        """
        if self.status == SessionStatus.COMPLETED:
            raise InvalidStateTransitionError(
                "既に完了済みのセッションです"
            )
        if not summary or not summary.strip():
            raise BusinessRuleViolationError(
                "セッションのまとめは必須です"
            )
        self.status = SessionStatus.COMPLETED
        self.summary = summary

    def add_message(self, role: str, content: str) -> "CoachingMessage":
        """
        メッセージを追加する。
        完了済みセッションには追加できない。
        """
        if self.status == SessionStatus.COMPLETED:
            raise InvalidStateTransitionError(
                "完了済みセッションにはメッセージを追加できません"
            )
        if role not in ["user", "assistant"]:
            raise BusinessRuleViolationError(
                f"Invalid role: {role}"
            )
        return CoachingMessage(
            session_id=self.id,
            role=role,
            content=content
        )

    @property
    def is_completed(self) -> bool:
        return self.status == SessionStatus.COMPLETED

    @property
    def is_in_progress(self) -> bool:
        return self.status == SessionStatus.IN_PROGRESS

    @property
    def message_count(self) -> int:
        return len(self.messages) if self.messages else 0


class CoachingMessage(Base):
    __tablename__ = "coaching_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("coaching_sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # "assistant" | "user"
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("CoachingSession", back_populates="messages")


class CoachingGoal(Base):
    __tablename__ = "coaching_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    due_date = Column(String, nullable=True)  # YYYY-MM-DD or null
    status = Column(String, nullable=False, default="active")  # "active" | "completed" | "abandoned"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def complete(self) -> None:
        """目標を達成済みにする"""
        if self.status == GoalStatus.COMPLETED:
            raise InvalidStateTransitionError("既に達成済みの目標です")
        if self.status == GoalStatus.ABANDONED:
            raise InvalidStateTransitionError("放棄済みの目標は完了できません")
        self.status = GoalStatus.COMPLETED

    def abandon(self) -> None:
        """目標を放棄する"""
        if self.status == GoalStatus.COMPLETED:
            raise InvalidStateTransitionError("達成済みの目標は放棄できません")
        self.status = GoalStatus.ABANDONED

    def reactivate(self) -> None:
        """放棄した目標を再開する"""
        if self.status == GoalStatus.ACTIVE:
            raise InvalidStateTransitionError("既にアクティブな目標です")
        self.status = GoalStatus.ACTIVE

    @property
    def is_active(self) -> bool:
        return self.status == GoalStatus.ACTIVE

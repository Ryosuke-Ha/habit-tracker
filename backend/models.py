from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database import Base


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


class WeeklyReview(Base):
    __tablename__ = "weekly_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)  # MVP: user email
    week_start_date = Column(Date, nullable=False)        # 必ず日曜日
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    kpt_items = relationship("KPTItem", back_populates="review", cascade="all, delete-orphan")


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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("CoachingMessage", back_populates="session", cascade="all, delete-orphan", order_by="CoachingMessage.created_at")


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

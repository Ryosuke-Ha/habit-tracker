from datetime import date
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from domain.value_objects import WeekPeriod
from models import DailyLog, Habit
from repositories.base import BaseRepository


class DailyLogRepository(BaseRepository[DailyLog]):
    """
    DailyLogのリポジトリ。
    習慣の日次記録に関するデータアクセスを担当する。
    """

    def __init__(self, db: Session):
        super().__init__(DailyLog, db)

    def find_by_date_and_template(
        self,
        target_date: date,
        template_id: int,
    ) -> List[DailyLog]:
        """指定日・テンプレートのDailyLogを取得"""
        return self._db.query(DailyLog).join(
            Habit, DailyLog.habit_id == Habit.id, isouter=True
        ).filter(
            DailyLog.date == target_date,
            DailyLog.template_id == template_id,
            DailyLog.is_deleted == False,  # noqa: E712
        ).order_by(DailyLog.scheduled_time).all()

    def find_by_week(
        self,
        week_period: WeekPeriod,
        template_id: Optional[int] = None,
    ) -> List[DailyLog]:
        """指定週のDailyLogを取得"""
        query = self._db.query(DailyLog).filter(
            DailyLog.date >= week_period.start,
            DailyLog.date <= week_period.end,
            DailyLog.is_deleted == False,  # noqa: E712
        )
        if template_id:
            query = query.filter(DailyLog.template_id == template_id)
        return query.all()

    def find_by_habit_and_date(
        self,
        habit_id: int,
        target_date: date,
    ) -> Optional[DailyLog]:
        """指定習慣・日付のDailyLogを取得"""
        return self._db.query(DailyLog).filter(
            DailyLog.habit_id == habit_id,
            DailyLog.date == target_date,
            DailyLog.is_deleted == False,  # noqa: E712
        ).first()

    def count_checked_in_week(
        self,
        week_period: WeekPeriod,
        template_id: Optional[int] = None,
    ) -> Tuple[int, int]:
        """
        指定週のチェック済み数と全体数を返す
        Returns: (checked_count, total_count)
        """
        logs = self.find_by_week(week_period, template_id)
        checked = sum(1 for log in logs if log.is_checked)
        return checked, len(logs)

from typing import List, Optional

from sqlalchemy.orm import Session

from models import Habit
from repositories.base import BaseRepository


class HabitRepository(BaseRepository[Habit]):
    """
    Habitのリポジトリ。
    習慣定義に関するデータアクセスを担当する。
    """

    def __init__(self, db: Session):
        super().__init__(Habit, db)

    def find_by_template(self, template_id: int) -> List[Habit]:
        """テンプレートの習慣一覧を取得（order昇順）"""
        return self._db.query(Habit).filter(
            Habit.template_id == template_id
        ).order_by(Habit.order).all()

    def find_by_template_ordered_by_time(self, template_id: int) -> List[Habit]:
        """テンプレートの習慣一覧を取得（scheduled_time昇順）"""
        return self._db.query(Habit).filter(
            Habit.template_id == template_id
        ).order_by(Habit.scheduled_time).all()

    def find_by_id_and_template(
        self,
        habit_id: int,
        template_id: int,
    ) -> Optional[Habit]:
        """
        IDとテンプレートIDでHabitを取得。
        集約境界の保護: 別テンプレートのHabitは取得できない。
        """
        return self._db.query(Habit).filter(
            Habit.id == habit_id,
            Habit.template_id == template_id,
        ).first()

    def get_max_order(self, template_id: int) -> int:
        """テンプレート内の最大orderを取得（新規追加時に使用）"""
        result = self._db.query(Habit).filter(
            Habit.template_id == template_id
        ).order_by(Habit.order.desc()).first()
        return result.order if result else 0

    def count_by_template(self, template_id: int) -> int:
        """テンプレート内の習慣数を取得"""
        return self._db.query(Habit).filter(
            Habit.template_id == template_id
        ).count()

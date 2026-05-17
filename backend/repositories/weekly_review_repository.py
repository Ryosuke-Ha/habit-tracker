from datetime import date
from typing import List, Optional

from sqlalchemy.orm import Session

from domain.enums import KPTType
from domain.value_objects import WeekPeriod
from models import KPTItem, WeeklyReview
from repositories.base import BaseRepository


class WeeklyReviewRepository(BaseRepository[WeeklyReview]):
    """
    WeeklyReviewのリポジトリ。
    週次振り返りに関するデータアクセスを担当する。
    """

    def __init__(self, db: Session):
        super().__init__(WeeklyReview, db)

    def find_by_user_and_week(
        self,
        user_id: str,
        week_start: date,
    ) -> Optional[WeeklyReview]:
        """指定ユーザー・週のWeeklyReviewを取得"""
        return self._db.query(WeeklyReview).filter(
            WeeklyReview.user_id == user_id,
            WeeklyReview.week_start_date == week_start,
        ).first()

    def find_current_by_user(
        self,
        user_id: str,
    ) -> Optional[WeeklyReview]:
        """今週のWeeklyReviewを取得"""
        week_period = WeekPeriod.current()
        return self.find_by_user_and_week(user_id, week_period.start)

    def find_previous_by_user(
        self,
        user_id: str,
    ) -> Optional[WeeklyReview]:
        """先週のWeeklyReviewを取得"""
        week_period = WeekPeriod.previous()
        return self.find_by_user_and_week(user_id, week_period.start)

    def find_all_by_user(
        self,
        user_id: str,
    ) -> List[WeeklyReview]:
        """ユーザーの全WeeklyReviewを新しい順で取得"""
        return self._db.query(WeeklyReview).filter(
            WeeklyReview.user_id == user_id,
        ).order_by(WeeklyReview.week_start_date.desc()).all()

    def get_try_items_for_display(
        self,
        user_id: str,
    ) -> List[KPTItem]:
        """
        TODO画面に表示する先週のTryアイテムを取得
        先週のWeeklyReviewのTryアイテムのみ返す
        """
        last_week_review = self.find_previous_by_user(user_id)
        if not last_week_review:
            return []
        return last_week_review.get_items_by_type(KPTType.TRY)

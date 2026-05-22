from datetime import date
from typing import List, Optional

from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from models import ScheduledTodo
from repositories.base import BaseRepository


class ScheduledTodoRepository(BaseRepository[ScheduledTodo]):
    """
    ScheduledTodoのリポジトリ。
    予定タスクに関するデータアクセスを担当する。
    """

    def __init__(self, db: Session):
        super().__init__(ScheduledTodo, db)

    def find_by_user(self, user_id: str) -> List[ScheduledTodo]:
        """ユーザーの全ScheduledTodoを取得（日付昇順）"""
        return self._db.query(ScheduledTodo).filter(
            ScheduledTodo.user_id == user_id
        ).order_by(ScheduledTodo.scheduled_date.asc()).all()

    def find_today_by_user(
        self,
        user_id: str,
        today: date,
    ) -> List[ScheduledTodo]:
        """今日のScheduledTodoを取得（時刻昇順）"""
        return self._db.query(ScheduledTodo).filter(
            ScheduledTodo.user_id == user_id,
            ScheduledTodo.scheduled_date == today,
        ).order_by(ScheduledTodo.scheduled_time.asc()).all()

    def find_future_by_user(
        self,
        user_id: str,
        from_date: date,
    ) -> List[ScheduledTodo]:
        """指定日以降のScheduledTodoを取得（日付昇順）"""
        return self._db.query(ScheduledTodo).filter(
            ScheduledTodo.user_id == user_id,
            ScheduledTodo.scheduled_date >= from_date,
        ).order_by(ScheduledTodo.scheduled_date.asc()).all()

    def find_by_id_and_user(
        self,
        todo_id: int,
        user_id: str,
    ) -> Optional[ScheduledTodo]:
        """IDとユーザーIDでScheduledTodoを取得（認可確認用）"""
        return self._db.query(ScheduledTodo).filter(
            ScheduledTodo.id == todo_id,
            ScheduledTodo.user_id == user_id,
        ).first()

    def find_pending_notifications(self, user_id: str) -> List[ScheduledTodo]:
        """
        通知が設定されているが未送信の未完了Todoを取得。
        通知チェック処理で使用する。
        """
        return self._db.query(ScheduledTodo).filter(
            ScheduledTodo.user_id == user_id,
            ScheduledTodo.is_completed == False,  # noqa: E712
            or_(
                and_(
                    ScheduledTodo.notification_offset_1.isnot(None),
                    ScheduledTodo.notification_sent_1 == False,  # noqa: E712
                ),
                and_(
                    ScheduledTodo.notification_offset_2.isnot(None),
                    ScheduledTodo.notification_sent_2 == False,  # noqa: E712
                ),
            ),
        ).all()

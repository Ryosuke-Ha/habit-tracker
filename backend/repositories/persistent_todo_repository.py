from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from models import PersistentTodo
from repositories.base import BaseRepository

JST = timezone(timedelta(hours=9))


class PersistentTodoRepository(BaseRepository[PersistentTodo]):
    """
    PersistentTodoのリポジトリ。
    持ち越しタスクに関するデータアクセスを担当する。
    """

    def __init__(self, db: Session):
        super().__init__(PersistentTodo, db)

    def find_by_user(self, user_id: str) -> List[PersistentTodo]:
        """ユーザーの全PersistentTodoを取得（作成日昇順）"""
        return self._db.query(PersistentTodo).filter(
            PersistentTodo.user_id == user_id
        ).order_by(PersistentTodo.created_at.asc()).all()

    def find_active_by_user(self, user_id: str) -> List[PersistentTodo]:
        """ユーザーの未完了PersistentTodoを取得（作成日昇順）"""
        return self._db.query(PersistentTodo).filter(
            PersistentTodo.user_id == user_id,
            PersistentTodo.is_completed == False,  # noqa: E712
        ).order_by(PersistentTodo.created_at.asc()).all()

    def find_long_pending_by_user(
        self,
        user_id: str,
        days_threshold: int = 7,
    ) -> List[PersistentTodo]:
        """
        指定日数以上持ち越している未完了Todoを取得。
        デフォルト7日以上。
        """
        threshold_dt = datetime.now(JST) - timedelta(days=days_threshold)
        return self._db.query(PersistentTodo).filter(
            PersistentTodo.user_id == user_id,
            PersistentTodo.is_completed == False,  # noqa: E712
            PersistentTodo.created_at <= threshold_dt,
        ).all()

    def find_by_id_and_user(
        self,
        todo_id: int,
        user_id: str,
    ) -> Optional[PersistentTodo]:
        """IDとユーザーIDでPersistentTodoを取得（認可確認用）"""
        return self._db.query(PersistentTodo).filter(
            PersistentTodo.id == todo_id,
            PersistentTodo.user_id == user_id,
        ).first()

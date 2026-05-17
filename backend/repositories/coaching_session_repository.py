from typing import List, Optional

from sqlalchemy.orm import Session

from domain.enums import SessionStatus
from domain.value_objects import WeekPeriod
from models import CoachingMessage, CoachingSession
from repositories.base import BaseRepository


class CoachingSessionRepository(BaseRepository[CoachingSession]):
    """
    CoachingSessionのリポジトリ。
    コーチングセッションに関するデータアクセスを担当する。
    """

    def __init__(self, db: Session):
        super().__init__(CoachingSession, db)

    def find_by_user(
        self,
        user_id: str,
    ) -> List[CoachingSession]:
        """ユーザーの全セッションを新しい順で取得"""
        return self._db.query(CoachingSession).filter(
            CoachingSession.user_id == user_id,
        ).order_by(CoachingSession.session_date.desc()).all()

    def find_current_by_user(
        self,
        user_id: str,
    ) -> Optional[CoachingSession]:
        """今週のセッションを取得"""
        week_period = WeekPeriod.current()
        return self._db.query(CoachingSession).filter(
            CoachingSession.user_id == user_id,
            CoachingSession.session_date >= week_period.start.isoformat(),
            CoachingSession.session_date <= week_period.end.isoformat(),
        ).first()

    def find_latest_completed_by_user(
        self,
        user_id: str,
    ) -> Optional[CoachingSession]:
        """
        最新の完了済みセッションを取得
        次回セッションのcontextに使用する
        """
        return self._db.query(CoachingSession).filter(
            CoachingSession.user_id == user_id,
            CoachingSession.status == SessionStatus.COMPLETED,
        ).order_by(CoachingSession.session_date.desc()).first()

    def find_recent_messages(
        self,
        session_id: int,
        limit: int = 5,
    ) -> List[CoachingMessage]:
        """
        直近のメッセージを取得（トークン節約のため件数制限）
        """
        return self._db.query(CoachingMessage).filter(
            CoachingMessage.session_id == session_id,
        ).order_by(CoachingMessage.created_at.desc()).limit(limit).all()[::-1]

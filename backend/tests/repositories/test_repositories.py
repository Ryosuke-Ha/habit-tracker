from unittest.mock import MagicMock
from domain.value_objects import WeekPeriod
from domain.enums import KPTType, SessionStatus
from repositories.daily_log_repository import DailyLogRepository
from repositories.weekly_review_repository import WeeklyReviewRepository
from repositories.coaching_session_repository import CoachingSessionRepository
from models import DailyLog, WeeklyReview, KPTItem, CoachingSession, CoachingMessage


class TestDailyLogRepository:
    def setup_method(self):
        self.mock_db = MagicMock()

    def test_count_checked_in_week(self):
        """週内のチェック済み数を正しく計算できる"""
        week_period = WeekPeriod.current()

        log1 = DailyLog()
        log1.is_checked = True
        log1.is_deleted = False

        log2 = DailyLog()
        log2.is_checked = False
        log2.is_deleted = False

        log3 = DailyLog()
        log3.is_checked = True
        log3.is_deleted = False

        repo = DailyLogRepository(self.mock_db)
        repo.find_by_week = MagicMock(return_value=[log1, log2, log3])

        checked, total = repo.count_checked_in_week(week_period)
        assert checked == 2
        assert total == 3


class TestWeeklyReviewRepository:
    def setup_method(self):
        self.mock_db = MagicMock()

    def test_get_try_items_for_display_returns_empty_if_no_last_week(self):
        """先週のレビューがない場合は空リストを返す"""
        repo = WeeklyReviewRepository(self.mock_db)
        repo.find_previous_by_user = MagicMock(return_value=None)

        result = repo.get_try_items_for_display(user_id="user@example.com")
        assert result == []

    def test_get_try_items_for_display_returns_try_items(self):
        """先週のTryアイテムを返す"""
        review = WeeklyReview()
        review.id = 1

        try_item = KPTItem()
        try_item.type = KPTType.TRY
        try_item.content = "試すこと"

        keep_item = KPTItem()
        keep_item.type = KPTType.KEEP
        keep_item.content = "良かったこと"

        review.kpt_items = [try_item, keep_item]

        repo = WeeklyReviewRepository(self.mock_db)
        repo.find_previous_by_user = MagicMock(return_value=review)

        result = repo.get_try_items_for_display(user_id="user@example.com")
        assert len(result) == 1
        assert result[0].type == KPTType.TRY


class TestCoachingSessionRepository:
    def setup_method(self):
        self.mock_db = MagicMock()

    def test_find_recent_messages_returns_limited_messages(self):
        """直近5件のメッセージのみ返す"""
        messages = []
        for i in range(10):
            msg = CoachingMessage()
            msg.id = i
            msg.content = f"message {i}"
            messages.append(msg)

        query_mock = MagicMock()
        query_mock.filter.return_value = query_mock
        query_mock.order_by.return_value = query_mock
        query_mock.limit.return_value = query_mock
        query_mock.all.return_value = messages[-5:]
        self.mock_db.query.return_value = query_mock

        repo = CoachingSessionRepository(self.mock_db)
        result = repo.find_recent_messages(session_id=1, limit=5)
        assert len(result) == 5

    def test_find_latest_completed_session(self):
        """最新の完了済みセッションを取得できる"""
        session = CoachingSession()
        session.id = 1
        session.status = SessionStatus.COMPLETED

        query_mock = MagicMock()
        query_mock.filter.return_value = query_mock
        query_mock.order_by.return_value = query_mock
        query_mock.first.return_value = session
        self.mock_db.query.return_value = query_mock

        repo = CoachingSessionRepository(self.mock_db)
        result = repo.find_latest_completed_by_user(user_id="user@example.com")
        assert result == session
        assert result.status == SessionStatus.COMPLETED

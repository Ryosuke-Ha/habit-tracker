import pytest
from domain.exceptions import AggregateNotFoundError
from models import WeeklyReview, KPTItem
from domain.enums import KPTType


class TestWeeklyReviewAggregateBoundary:
    """WeeklyReview集約の境界保護テスト"""

    def setup_method(self):
        self.review = WeeklyReview()
        self.review.id = 1
        self.review.user_id = "test@example.com"

        self.item1 = KPTItem()
        self.item1.id = 1
        self.item1.review_id = 1
        self.item1.type = KPTType.KEEP
        self.item1.content = "良かったこと"

        self.item2 = KPTItem()
        self.item2.id = 2
        self.item2.review_id = 2  # 別のreviewに属する
        self.item2.type = KPTType.PROBLEM

        self.review.kpt_items = [self.item1]

    def test_find_kpt_item_returns_own_item(self):
        """自分のレビューのKPTItemは取得できる"""
        item = self.review.find_kpt_item(1)
        assert item == self.item1

    def test_find_kpt_item_raises_for_other_review_item(self):
        """他のレビューのKPTItemは取得できない（集約境界の保護）"""
        with pytest.raises(AggregateNotFoundError):
            self.review.find_kpt_item(2)

    def test_find_kpt_item_raises_for_nonexistent_item(self):
        """存在しないKPTItemは取得できない"""
        with pytest.raises(AggregateNotFoundError):
            self.review.find_kpt_item(999)

    def test_add_kpt_item_belongs_to_review(self):
        """追加したKPTItemはこのレビューに属する"""
        item = self.review.add_kpt_item(KPTType.TRY, "試すこと")
        assert item.review_id == self.review.id

    def test_get_items_by_type(self):
        """種別でKPTItemを取得できる"""
        keep_items = self.review.get_items_by_type(KPTType.KEEP)
        assert len(keep_items) == 1
        assert keep_items[0] == self.item1

    def test_get_items_by_type_empty(self):
        """該当する種別がない場合は空リストを返す"""
        problem_items = self.review.get_items_by_type(KPTType.PROBLEM)
        assert problem_items == []


class TestCoachingSessionAggregateBoundary:
    """CoachingSession集約の境界保護テスト"""

    def setup_method(self):
        from models import CoachingSession
        from domain.enums import SessionStatus
        self.session = CoachingSession()
        self.session.id = 1
        self.session.status = SessionStatus.IN_PROGRESS
        self.session.messages = []

    def test_message_belongs_to_session(self):
        """追加したメッセージはこのセッションに属する"""
        message = self.session.add_message("user", "テスト")
        assert message.session_id == self.session.id

    def test_cannot_add_message_to_completed_session(self):
        """完了済みセッションにはメッセージを追加できない（集約境界の保護）"""
        from domain.enums import SessionStatus
        from domain.exceptions import InvalidStateTransitionError
        self.session.status = SessionStatus.COMPLETED
        with pytest.raises(InvalidStateTransitionError):
            self.session.add_message("user", "追加できないはず")

    def test_complete_transitions_status(self):
        """完了操作で状態が正しく遷移する"""
        from domain.enums import SessionStatus
        self.session.complete("まとめ")
        assert self.session.status == SessionStatus.COMPLETED
        assert self.session.summary == "まとめ"

    def test_double_complete_raises(self):
        """二重完了は集約ルールで防止される"""
        from domain.exceptions import InvalidStateTransitionError
        self.session.complete("まとめ")
        with pytest.raises(InvalidStateTransitionError):
            self.session.complete("再度まとめ")

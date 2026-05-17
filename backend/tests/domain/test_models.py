import pytest
from unittest.mock import MagicMock
from domain.enums import SessionStatus, GoalStatus, KPTType
from domain.exceptions import InvalidStateTransitionError, BusinessRuleViolationError
from models import CoachingSession, CoachingGoal, DailyLog, WeeklyReview


class TestCoachingSession:
    def setup_method(self):
        self.session = CoachingSession()
        self.session.id = 1
        self.session.status = SessionStatus.IN_PROGRESS
        self.session.messages = []

    def test_complete_success(self):
        self.session.complete("今日の気づき")
        assert self.session.status == SessionStatus.COMPLETED
        assert self.session.summary == "今日の気づき"

    def test_complete_raises_if_already_completed(self):
        self.session.status = SessionStatus.COMPLETED
        with pytest.raises(InvalidStateTransitionError):
            self.session.complete("まとめ")

    def test_complete_raises_if_empty_summary(self):
        with pytest.raises(BusinessRuleViolationError):
            self.session.complete("")

    def test_add_message_success(self):
        message = self.session.add_message("user", "今週は良かったです")
        assert message.role == "user"
        assert message.content == "今週は良かったです"

    def test_add_message_raises_if_completed(self):
        self.session.status = SessionStatus.COMPLETED
        with pytest.raises(InvalidStateTransitionError):
            self.session.add_message("user", "メッセージ")

    def test_is_completed_property(self):
        assert not self.session.is_completed
        self.session.status = SessionStatus.COMPLETED
        assert self.session.is_completed


class TestCoachingGoal:
    def setup_method(self):
        self.goal = CoachingGoal()
        self.goal.status = GoalStatus.ACTIVE

    def test_complete_success(self):
        self.goal.complete()
        assert self.goal.status == GoalStatus.COMPLETED

    def test_complete_raises_if_already_completed(self):
        self.goal.status = GoalStatus.COMPLETED
        with pytest.raises(InvalidStateTransitionError):
            self.goal.complete()

    def test_abandon_success(self):
        self.goal.abandon()
        assert self.goal.status == GoalStatus.ABANDONED

    def test_abandon_raises_if_completed(self):
        self.goal.status = GoalStatus.COMPLETED
        with pytest.raises(InvalidStateTransitionError):
            self.goal.abandon()

    def test_reactivate_success(self):
        self.goal.status = GoalStatus.ABANDONED
        self.goal.reactivate()
        assert self.goal.status == GoalStatus.ACTIVE


class TestDailyLog:
    def setup_method(self):
        self.log = DailyLog()
        self.log.is_checked = False

    def test_check(self):
        self.log.check()
        assert self.log.is_checked is True

    def test_uncheck(self):
        self.log.is_checked = True
        self.log.uncheck()
        assert self.log.is_checked is False

    def test_toggle_false_to_true(self):
        self.log.toggle()
        assert self.log.is_checked is True

    def test_toggle_true_to_false(self):
        self.log.is_checked = True
        self.log.toggle()
        assert self.log.is_checked is False

    def test_is_accomplished_alias(self):
        self.log.is_checked = True
        assert self.log.is_accomplished is True


class TestWeeklyReview:
    def setup_method(self):
        self.review = WeeklyReview()
        self.review.id = 1
        self.review.kpt_items = []

    def test_add_kpt_item_success(self):
        item = self.review.add_kpt_item(KPTType.KEEP, "良かったこと")
        assert item.type == KPTType.KEEP
        assert item.content == "良かったこと"
        assert item.review_id == 1

    def test_add_kpt_item_strips_whitespace(self):
        item = self.review.add_kpt_item(KPTType.KEEP, "  良かったこと  ")
        assert item.content == "良かったこと"

    def test_add_kpt_item_raises_if_empty(self):
        with pytest.raises(BusinessRuleViolationError):
            self.review.add_kpt_item(KPTType.KEEP, "")

    def test_find_kpt_item_success(self):
        mock_item = MagicMock()
        mock_item.id = 1
        self.review.kpt_items = [mock_item]
        found = self.review.find_kpt_item(1)
        assert found == mock_item

    def test_find_kpt_item_raises_if_not_found(self):
        from domain.exceptions import AggregateNotFoundError
        with pytest.raises(AggregateNotFoundError):
            self.review.find_kpt_item(999)

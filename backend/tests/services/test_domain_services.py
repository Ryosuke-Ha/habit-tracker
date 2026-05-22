from datetime import date
from unittest.mock import MagicMock

from domain.value_objects import WeekPeriod
from models import DailyLog, Habit
from services.domain.achievement_service import (
    MonthlyAchievementService,
    WeeklyAchievementService,
)
from services.domain.daily_log_service import DailyLogGenerationService


class TestWeeklyAchievementService:
    def setup_method(self):
        self.mock_db = MagicMock()

    def test_calc_achievement_rate_returns_correct_value(self):
        service = WeeklyAchievementService(self.mock_db)
        service._daily_log_repo = MagicMock()
        service._daily_log_repo.count_checked_in_week.return_value = (3, 4)

        week_period = WeekPeriod.current()
        rate = service.calc_achievement_rate(week_period)

        assert rate.value == 75

    def test_calc_achievement_rate_returns_zero_when_no_logs(self):
        service = WeeklyAchievementService(self.mock_db)
        service._daily_log_repo = MagicMock()
        service._daily_log_repo.count_checked_in_week.return_value = (0, 0)

        rate = service.calc_achievement_rate(WeekPeriod.current())
        assert rate.value == 0

    def test_calc_vs_last_week_positive(self):
        service = WeeklyAchievementService(self.mock_db)
        service._daily_log_repo = MagicMock()
        # 先週: 3/4 = 75%, 今週: 100%
        service._daily_log_repo.count_checked_in_week.return_value = (3, 4)

        result = service.calc_vs_last_week(WeekPeriod.current(), 100)
        assert result == "+25%"

    def test_calc_vs_last_week_returns_none_when_no_last_week_data(self):
        service = WeeklyAchievementService(self.mock_db)
        service._daily_log_repo = MagicMock()
        service._daily_log_repo.count_checked_in_week.return_value = (0, 0)

        result = service.calc_vs_last_week(WeekPeriod.current(), 80)
        assert result is None

    def test_find_weakest_habit(self):
        service = WeeklyAchievementService(self.mock_db)

        log1 = DailyLog()
        log1.habit_id = 1
        log1.is_checked = True

        log2 = DailyLog()
        log2.habit_id = 2
        log2.is_checked = False

        service._daily_log_repo = MagicMock()
        service._daily_log_repo.find_by_week.return_value = [log1, log2]

        weakest_habit = Habit()
        weakest_habit.title = "英語学習"
        self.mock_db.query.return_value.filter.return_value.first.return_value = weakest_habit

        weakest = service.find_weakest_habit(WeekPeriod.current())
        assert weakest == "英語学習"

    def test_find_strongest_habit(self):
        service = WeeklyAchievementService(self.mock_db)

        log1 = DailyLog()
        log1.habit_id = 1
        log1.is_checked = True

        log2 = DailyLog()
        log2.habit_id = 2
        log2.is_checked = False

        service._daily_log_repo = MagicMock()
        service._daily_log_repo.find_by_week.return_value = [log1, log2]

        strongest_habit = Habit()
        strongest_habit.title = "筋トレ"
        self.mock_db.query.return_value.filter.return_value.first.return_value = strongest_habit

        strongest = service.find_strongest_habit(WeekPeriod.current())
        assert strongest == "筋トレ"

    def test_find_weakest_returns_none_when_no_habits(self):
        service = WeeklyAchievementService(self.mock_db)
        service._daily_log_repo = MagicMock()
        service._daily_log_repo.find_by_week.return_value = []

        result = service.find_weakest_habit(WeekPeriod.current())
        assert result is None

    def test_get_weekly_stats_returns_expected_keys(self):
        service = WeeklyAchievementService(self.mock_db)
        service._daily_log_repo = MagicMock()
        service._daily_log_repo.count_checked_in_week.return_value = (5, 7)
        service._daily_log_repo.find_by_week.return_value = []

        stats = service.get_weekly_stats(WeekPeriod.current())

        assert "achievement_rate" in stats
        assert "checked_habits" in stats
        assert "total_habits" in stats
        assert "weakest_habit" in stats
        assert "strongest_habit" in stats
        assert stats["achievement_rate"] == 71
        assert stats["checked_habits"] == 5
        assert stats["total_habits"] == 7


class TestMonthlyAchievementService:
    def setup_method(self):
        self.mock_db = MagicMock()
        self.service = MonthlyAchievementService(self.mock_db)

    def test_calc_overall_rate(self):
        logs = []
        for i in range(10):
            log = DailyLog()
            log.is_checked = i < 7
            logs.append(log)

        rate = self.service.calc_overall_rate(logs)
        assert rate.value == 70

    def test_calc_overall_rate_empty_logs(self):
        rate = self.service.calc_overall_rate([])
        assert rate.value == 0

    def test_calc_streak_max(self):
        today = date(2026, 5, 22)
        logs = []
        for d in [
            date(2026, 5, 18),
            date(2026, 5, 19),
            date(2026, 5, 20),
            date(2026, 5, 21),
            date(2026, 5, 22),
        ]:
            log = DailyLog()
            log.date = d
            log.is_checked = True
            logs.append(log)

        streak = self.service.calc_streak_max(logs, 2026, 5, today)
        assert streak == 5

    def test_calc_streak_max_with_gap(self):
        today = date(2026, 5, 22)
        logs = []
        # 5/18-5/19: 達成, 5/20: 未達成, 5/21-5/22: 達成
        for d, checked in [
            (date(2026, 5, 18), True),
            (date(2026, 5, 19), True),
            (date(2026, 5, 20), False),
            (date(2026, 5, 21), True),
            (date(2026, 5, 22), True),
        ]:
            log = DailyLog()
            log.date = d
            log.is_checked = checked
            logs.append(log)

        streak = self.service.calc_streak_max(logs, 2026, 5, today)
        assert streak == 2

    def test_calc_total_days_checked(self):
        today = date(2026, 5, 22)
        logs = []
        for d, checked in [
            (date(2026, 5, 20), True),
            (date(2026, 5, 21), False),
            (date(2026, 5, 22), True),
        ]:
            log = DailyLog()
            log.date = d
            log.is_checked = checked
            logs.append(log)

        total = self.service.calc_total_days_checked(logs, today)
        assert total == 2

    def test_build_monthly_summary_keys(self):
        today = date(2026, 5, 22)
        log = DailyLog()
        log.date = today
        log.is_checked = True

        summary = self.service.build_monthly_summary(2026, 5, [log], today)
        assert "overall_rate" in summary
        assert "total_days_checked" in summary
        assert "streak_max" in summary

    def test_build_monthly_summary_values(self):
        today = date(2026, 5, 1)
        logs = []
        for i in range(4):
            log = DailyLog()
            log.date = today
            log.is_checked = i < 3  # 3 checked, 1 unchecked
            logs.append(log)

        summary = self.service.build_monthly_summary(2026, 5, logs, today)
        assert summary["overall_rate"] == 75


class TestDailyLogGenerationService:
    def setup_method(self):
        self.mock_db = MagicMock()

    def test_detach_logs_from_habit(self):
        service = DailyLogGenerationService(self.mock_db)

        habit = Habit()
        habit.id = 1
        habit.title = "筋トレ"
        habit.scheduled_time = "07:00"
        habit.location = "ジム"
        habit.template_id = 1

        log1 = DailyLog()
        log1.habit_id = 1
        log1.title = None

        self.mock_db.query.return_value.filter.return_value.all.return_value = [log1]

        service.detach_logs_from_habit(habit)

        assert log1.habit_id is None
        assert log1.title == "筋トレ"
        assert log1.scheduled_time == "07:00"
        assert log1.location == "ジム"
        assert log1.template_id == 1
        self.mock_db.flush.assert_called_once()

    def test_detach_logs_from_habit_no_logs(self):
        service = DailyLogGenerationService(self.mock_db)

        habit = Habit()
        habit.id = 99
        habit.title = "読書"
        habit.scheduled_time = "22:00"
        habit.location = "寝室"
        habit.template_id = 1

        self.mock_db.query.return_value.filter.return_value.all.return_value = []

        service.detach_logs_from_habit(habit)

        self.mock_db.flush.assert_called_once()

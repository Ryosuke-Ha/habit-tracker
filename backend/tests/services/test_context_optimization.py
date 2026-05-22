import datetime
from unittest.mock import MagicMock

from services.domain.achievement_service import MonthlyAchievementService


def _make_log(date: datetime.date, is_checked: bool) -> MagicMock:
    log = MagicMock()
    log.date = date
    log.is_checked = is_checked
    return log


class TestMonthlyAchievementServiceNewMethods:
    def setup_method(self):
        self.mock_db = MagicMock()
        self.service = MonthlyAchievementService(self.mock_db)

    # --- calc_current_streak ---

    def test_calc_current_streak_returns_zero_when_no_logs(self):
        today = datetime.date(2026, 5, 22)
        result = self.service.calc_current_streak([], today)
        assert result == 0

    def test_calc_current_streak_counts_consecutive_days(self):
        today = datetime.date(2026, 5, 22)
        logs = [
            _make_log(datetime.date(2026, 5, 22), True),
            _make_log(datetime.date(2026, 5, 21), True),
            _make_log(datetime.date(2026, 5, 20), True),
        ]
        result = self.service.calc_current_streak(logs, today)
        assert result == 3

    def test_calc_current_streak_stops_at_gap(self):
        today = datetime.date(2026, 5, 22)
        logs = [
            _make_log(datetime.date(2026, 5, 22), True),
            _make_log(datetime.date(2026, 5, 21), False),
            _make_log(datetime.date(2026, 5, 20), True),
        ]
        result = self.service.calc_current_streak(logs, today)
        assert result == 1

    def test_calc_current_streak_today_not_checked_returns_zero(self):
        today = datetime.date(2026, 5, 22)
        logs = [
            _make_log(datetime.date(2026, 5, 22), False),
            _make_log(datetime.date(2026, 5, 21), True),
        ]
        result = self.service.calc_current_streak(logs, today)
        assert result == 0

    # --- calc_weekly_rates ---

    def test_calc_weekly_rates_returns_empty_for_no_logs(self):
        result = self.service.calc_weekly_rates([])
        assert result == []

    def test_calc_weekly_rates_returns_list_with_week_start_and_rate(self):
        # 2026-05-18 (月) and 2026-05-19 (火) — same week starting 2026-05-17 (日)
        logs = [
            _make_log(datetime.date(2026, 5, 18), True),
            _make_log(datetime.date(2026, 5, 18), False),
        ]
        result = self.service.calc_weekly_rates(logs)
        assert len(result) == 1
        assert result[0]["rate"] == 50

    def test_calc_weekly_rates_multiple_weeks(self):
        logs = [
            _make_log(datetime.date(2026, 5, 11), True),   # week1
            _make_log(datetime.date(2026, 5, 18), True),   # week2
            _make_log(datetime.date(2026, 5, 18), True),   # week2
        ]
        result = self.service.calc_weekly_rates(logs)
        assert len(result) == 2
        assert result[0]["rate"] == 100
        assert result[1]["rate"] == 100

    # --- build_monthly_stats ---

    def test_build_monthly_stats_empty_logs(self):
        today = datetime.date(2026, 5, 22)
        result = self.service.build_monthly_stats(2026, 5, [], today)
        assert result["overall_rate"] == 0
        assert result["streak_max"] == 0
        assert result["current_streak"] == 0
        assert result["total_days_checked"] == 0
        assert result["weekly_rates"] == []
        assert result["low_achievement_count"] == 0
        assert result["low_achievement_weekday"] is None

    def test_build_monthly_stats_has_required_keys(self):
        today = datetime.date(2026, 5, 22)
        logs = [_make_log(datetime.date(2026, 5, 22), True)]
        result = self.service.build_monthly_stats(2026, 5, logs, today)
        expected_keys = {
            "overall_rate",
            "streak_max",
            "current_streak",
            "total_days_checked",
            "weekly_rates",
            "low_achievement_count",
            "low_achievement_weekday",
        }
        assert expected_keys == set(result.keys())

    def test_build_monthly_stats_low_achievement_weekday(self):
        today = datetime.date(2026, 5, 22)
        # Add multiple low-achievement Mondays (weekday=0)
        logs = [
            _make_log(datetime.date(2026, 5, 4), False),   # Monday
            _make_log(datetime.date(2026, 5, 11), False),  # Monday
            _make_log(datetime.date(2026, 5, 18), False),  # Monday
            _make_log(datetime.date(2026, 5, 6), True),    # Wednesday (high achievement)
        ]
        result = self.service.build_monthly_stats(2026, 5, logs, today)
        assert result["low_achievement_count"] == 3
        assert result["low_achievement_weekday"] == "月"

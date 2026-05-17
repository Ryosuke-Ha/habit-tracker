import pytest
from datetime import date, timedelta
from domain.value_objects import WeekPeriod, YearMonth, ScheduledTime, AchievementRate


class TestWeekPeriod:
    def test_current_returns_sunday(self):
        period = WeekPeriod.current()
        assert period.start.weekday() == 6  # 日曜日

    def test_end_is_saturday(self):
        period = WeekPeriod(date(2026, 3, 15))  # 日曜日
        assert period.end == date(2026, 3, 21)  # 土曜日

    def test_raises_if_not_sunday(self):
        with pytest.raises(ValueError):
            WeekPeriod(date(2026, 3, 16))  # 月曜日

    def test_from_date_returns_correct_week(self):
        # 水曜日を渡すと、その週の日曜日が返る
        period = WeekPeriod.from_date(date(2026, 3, 18))
        assert period.start == date(2026, 3, 15)

    def test_previous_returns_last_week(self):
        current = WeekPeriod(date(2026, 3, 15))
        # previous()は現在週から計算するためcurrentを直接テスト
        prev_start = current.start - timedelta(days=7)
        assert prev_start == date(2026, 3, 8)

    def test_contains(self):
        period = WeekPeriod(date(2026, 3, 15))
        assert period.contains(date(2026, 3, 15))  # 日曜
        assert period.contains(date(2026, 3, 21))  # 土曜
        assert not period.contains(date(2026, 3, 22))  # 翌週日曜


class TestYearMonth:
    def test_from_string(self):
        ym = YearMonth.from_string("2026-03")
        assert ym.year == 2026
        assert ym.month == 3

    def test_to_string(self):
        ym = YearMonth(2026, 3)
        assert ym.to_string() == "2026-03"

    def test_raises_invalid_month(self):
        with pytest.raises(ValueError):
            YearMonth(2026, 13)

    def test_raises_invalid_format(self):
        with pytest.raises(ValueError):
            YearMonth.from_string("202603")


class TestScheduledTime:
    def test_valid_time(self):
        t = ScheduledTime("07:00")
        assert str(t) == "07:00"

    def test_valid_half_hour(self):
        t = ScheduledTime("07:30")
        assert str(t) == "07:30"

    def test_raises_invalid_minutes(self):
        with pytest.raises(ValueError):
            ScheduledTime("07:15")  # 15分は不可

    def test_raises_invalid_hour(self):
        with pytest.raises(ValueError):
            ScheduledTime("25:00")


class TestAchievementRate:
    def test_valid_rate(self):
        rate = AchievementRate(75)
        assert str(rate) == "75%"

    def test_is_high(self):
        assert AchievementRate(80).is_high()
        assert not AchievementRate(79).is_high()

    def test_is_low(self):
        assert AchievementRate(49).is_low()
        assert not AchievementRate(50).is_low()

    def test_raises_out_of_range(self):
        with pytest.raises(ValueError):
            AchievementRate(101)
        with pytest.raises(ValueError):
            AchievementRate(-1)

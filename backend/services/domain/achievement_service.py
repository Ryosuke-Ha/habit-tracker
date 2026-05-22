import calendar
import datetime
from collections import defaultdict
from datetime import timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

import models
from domain.enums import KPTType
from domain.value_objects import AchievementRate, WeekPeriod
from repositories.daily_log_repository import DailyLogRepository
from repositories.weekly_review_repository import WeeklyReviewRepository


class WeeklyAchievementService:
    """
    週次達成率に関するドメインサービス。
    DailyLog・Habit・WeeklyReviewをまたぐ計算を担当する。
    """

    def __init__(self, db: Session):
        self._db = db
        self._daily_log_repo = DailyLogRepository(db)
        self._weekly_review_repo = WeeklyReviewRepository(db)

    def calc_achievement_rate(
        self,
        week_period: WeekPeriod,
        template_id: Optional[int] = None,
    ) -> AchievementRate:
        """週の達成率を計算する"""
        checked, total = self._daily_log_repo.count_checked_in_week(week_period, template_id)
        value = round(checked / total * 100) if total > 0 else 0
        return AchievementRate(value)

    def calc_vs_last_week(
        self,
        week_period: WeekPeriod,
        current_rate_value: int,
        template_id: Optional[int] = None,
    ) -> Optional[str]:
        """先週比を計算して文字列で返す。先週データがなければNoneを返す"""
        last_week = WeekPeriod(week_period.start - timedelta(days=7))
        _, last_total = self._daily_log_repo.count_checked_in_week(last_week, template_id)
        if last_total == 0:
            return None
        last_rate = self.calc_achievement_rate(last_week, template_id)
        diff = current_rate_value - last_rate.value
        return f"+{diff}%" if diff >= 0 else f"{diff}%"

    def find_weakest_habit(self, week_period: WeekPeriod) -> Optional[str]:
        """週内で最も達成率が低い習慣名を返す"""
        logs = self._daily_log_repo.find_by_week(week_period)
        return self._find_habit_by_rate(logs, weakest=True)

    def find_strongest_habit(self, week_period: WeekPeriod) -> Optional[str]:
        """週内で最も達成率が高い習慣名を返す"""
        logs = self._daily_log_repo.find_by_week(week_period)
        return self._find_habit_by_rate(logs, weakest=False)

    def _find_habit_by_rate(self, logs: list, weakest: bool) -> Optional[str]:
        habit_logs: dict = defaultdict(list)
        for log in logs:
            if log.habit_id is not None:
                habit_logs[log.habit_id].append(log)

        if not habit_logs:
            return None

        habit_rates = {
            habit_id: sum(1 for lg in h_logs if lg.is_checked) / len(h_logs)
            for habit_id, h_logs in habit_logs.items()
        }
        target_id = (
            min(habit_rates, key=lambda k: habit_rates[k])
            if weakest
            else max(habit_rates, key=lambda k: habit_rates[k])
        )
        habit_obj = self._db.query(models.Habit).filter(models.Habit.id == target_id).first()
        return habit_obj.title if habit_obj else None

    def calc_last_week_try_completion(
        self,
        user_id: str,
        week_period: WeekPeriod,
    ) -> Optional[str]:
        """先週のTry達成状況を 'X/Y' 形式で返す。データなしはNone"""
        last_week_start = week_period.start - timedelta(days=7)
        prev_review = (
            self._db.query(models.WeeklyReview)
            .filter_by(user_id=user_id, week_start_date=last_week_start)
            .first()
        )
        if not prev_review:
            return None
        try_items = [i for i in prev_review.kpt_items if i.type == KPTType.TRY]
        if not try_items:
            return None
        completed = sum(1 for i in try_items if i.is_completed)
        return f"{completed}/{len(try_items)}"

    def get_weekly_stats(
        self,
        week_period: WeekPeriod,
        template_id: Optional[int] = None,
    ) -> dict:
        """
        週次統計の全データを返す。
        weekly_stats.pyの既存関数から委譲される共通実装。
        """
        checked, total = self._daily_log_repo.count_checked_in_week(week_period, template_id)
        rate = round(checked / total * 100) if total > 0 else 0
        weakest = self.find_weakest_habit(week_period)
        strongest = self.find_strongest_habit(week_period)
        return {
            "achievement_rate": rate,
            "checked_habits": checked,
            "total_habits": total,
            "weakest_habit": weakest,
            "strongest_habit": strongest,
        }


class MonthlyAchievementService:
    """
    月次達成率に関するドメインサービス。
    DailyLogをまたぐ月次集計を担当する。
    """

    def __init__(self, db: Session):
        self._db = db

    def calc_overall_rate(self, logs: list) -> AchievementRate:
        """月全体の達成率を計算する"""
        if not logs:
            return AchievementRate(0)
        checked = sum(1 for log in logs if log.is_checked)
        value = round(checked / len(logs) * 100)
        return AchievementRate(value)

    def calc_streak_max(
        self,
        logs: list,
        year: int,
        month: int,
        today: datetime.date,
    ) -> int:
        """月内の最長連続達成日数を計算する（1日でもチェックがあれば達成とみなす）"""
        last_day = calendar.monthrange(year, month)[1]
        first_day = datetime.date(year, month, 1)
        calc_until = min(datetime.date(year, month, last_day), today)

        date_logs: dict = defaultdict(list)
        for log in logs:
            date_logs[log.date].append(log)

        max_streak = 0
        current = 0
        d = first_day
        while d <= calc_until:
            if any(lg.is_checked for lg in date_logs[d]):
                current += 1
                if current > max_streak:
                    max_streak = current
            else:
                current = 0
            d += timedelta(days=1)

        return max_streak

    def calc_total_days_checked(
        self,
        logs: list,
        today: datetime.date,
    ) -> int:
        """1件以上チェック済みの日数を返す"""
        date_logs: dict = defaultdict(list)
        for log in logs:
            date_logs[log.date].append(log)
        return sum(
            1 for d, day_logs in date_logs.items()
            if d <= today and any(lg.is_checked for lg in day_logs)
        )

    def calc_current_streak(self, logs: list, today: datetime.date) -> int:
        """今日から遡った連続達成日数を計算する"""
        date_logs: dict = defaultdict(list)
        for log in logs:
            date_logs[log.date].append(log)

        streak = 0
        d = today
        while True:
            day_logs = date_logs.get(d, [])
            if day_logs and any(lg.is_checked for lg in day_logs):
                streak += 1
                d -= timedelta(days=1)
            else:
                break
        return streak

    def calc_weekly_rates(self, logs: list) -> List[dict]:
        """週ごとの達成率をリストで返す [{"week_start": "MM/DD", "rate": int}]"""
        week_buckets: dict = defaultdict(list)
        for log in logs:
            days_since_sunday = (log.date.weekday() + 1) % 7
            week_sun = log.date - timedelta(days=days_since_sunday)
            week_buckets[week_sun].append(log)

        result = []
        for week_sun in sorted(week_buckets):
            week_logs = week_buckets[week_sun]
            total = len(week_logs)
            checked = sum(1 for lg in week_logs if lg.is_checked)
            pct = round(checked / total * 100) if total > 0 else 0
            result.append({"week_start": week_sun.strftime("%m/%d"), "rate": pct})
        return result

    def build_monthly_stats(
        self,
        year: int,
        month: int,
        logs: list,
        today: datetime.date,
    ) -> dict:
        """月次AI分析用の統計データをまとめて返す"""
        overall_rate = self.calc_overall_rate(logs)
        streak_max = self.calc_streak_max(logs, year, month, today)
        current_streak = self.calc_current_streak(logs, today)
        total_days_checked = self.calc_total_days_checked(logs, today)
        weekly_rates = self.calc_weekly_rates(logs)

        date_logs: dict = defaultdict(list)
        for log in logs:
            date_logs[log.date].append(log)

        low_days = []
        for d, day_logs in date_logs.items():
            if d > today:
                continue
            total = len(day_logs)
            if total > 0:
                rate = sum(1 for lg in day_logs if lg.is_checked) / total
                if rate <= 0.5:
                    low_days.append(d)

        low_achievement_count = len(low_days)
        weekday_names = ["月", "火", "水", "木", "金", "土", "日"]
        weekday_count: dict = defaultdict(int)
        for d in low_days:
            weekday_count[d.weekday()] += 1

        low_achievement_weekday = None
        if weekday_count:
            most_common = max(weekday_count, key=lambda k: weekday_count[k])
            low_achievement_weekday = weekday_names[most_common]

        return {
            "overall_rate": overall_rate.value,
            "streak_max": streak_max,
            "current_streak": current_streak,
            "total_days_checked": total_days_checked,
            "weekly_rates": weekly_rates,
            "low_achievement_count": low_achievement_count,
            "low_achievement_weekday": low_achievement_weekday,
        }

    def build_monthly_summary(
        self,
        year: int,
        month: int,
        logs: list,
        today: datetime.date,
    ) -> dict:
        """
        月次サマリー統計を返す。
        monthly_reviews.pyのlist_monthly_reviewsで使用する。
        """
        overall_rate = self.calc_overall_rate(logs)
        streak_max = self.calc_streak_max(logs, year, month, today)
        total_days_checked = self.calc_total_days_checked(logs, today)

        return {
            "overall_rate": overall_rate.value,
            "total_days_checked": total_days_checked,
            "streak_max": streak_max,
        }

import os
import requests
from datetime import datetime, timezone, timedelta

API_URL = os.getenv("HABIT_TRACKER_API_URL")
USER_EMAIL = os.getenv("HABIT_TRACKER_USER_EMAIL")

JST = timezone(timedelta(hours=9))


def get_auth_headers() -> dict:
    return {
        "X-User-Email": USER_EMAIL,
        "Content-Type": "application/json",
    }


def get_today_habits() -> dict:
    """今日の習慣一覧を取得"""
    resp = requests.get(f"{API_URL}/templates", headers=get_auth_headers())
    resp.raise_for_status()
    templates = resp.json()

    weekday = datetime.now(JST).weekday()
    is_weekday = weekday < 5

    template = next(
        (t for t in templates if ("平日" in t["name"]) == is_weekday),
        templates[0] if templates else None,
    )
    if not template:
        return {"error": "テンプレートが見つかりません"}

    logs_resp = requests.get(
        f"{API_URL}/logs/today?template_id={template['id']}",
        headers=get_auth_headers(),
    )
    logs_resp.raise_for_status()
    logs = logs_resp.json()

    return {"template": template["name"], "habits": logs}


def check_habit(habit_title: str) -> dict:
    """習慣名でチェックする"""
    today_data = get_today_habits()
    if "error" in today_data:
        return today_data

    habits = today_data["habits"]
    target = next(
        (h for h in habits if habit_title in h.get("title", "")),
        None,
    )
    if not target:
        return {"error": f"「{habit_title}」が見つかりません"}

    if target.get("is_checked"):
        return {"message": f"「{target['title']}」は既にチェック済みです"}

    resp = requests.post(
        f"{API_URL}/logs/{target['id']}/toggle",
        headers=get_auth_headers(),
    )
    resp.raise_for_status()

    return {"message": f"「{target['title']}」をチェックしました"}


def get_achievement_rate() -> dict:
    """今週の達成率を取得"""
    today = datetime.now(JST)
    days_since_sunday = (today.weekday() + 1) % 7
    week_start = (today - timedelta(days=days_since_sunday)).strftime("%Y-%m-%d")

    resp = requests.get(
        f"{API_URL}/reviews/weekly/{week_start}",
        headers=get_auth_headers(),
    )
    resp.raise_for_status()
    review = resp.json()

    return {
        "achievement_rate": review.get("achievement_rate", 0),
        "vs_last_week": review.get("achievement_rate_vs_last_week", "N/A"),
        "weakest_habit": review.get("weakest_habit", "N/A"),
        "strongest_habit": review.get("strongest_habit", "N/A"),
        "week_start": week_start,
    }


def add_scheduled_todo(
    title: str,
    date: str,
    time: str = None,
    location: str = None,
) -> dict:
    """TODOメモを追加（date: YYYY-MM-DD形式）"""
    payload = {
        "title": title,
        "scheduled_date": date,
        "scheduled_time": time,
        "location": location,
    }
    resp = requests.post(
        f"{API_URL}/scheduled-todos",
        json=payload,
        headers=get_auth_headers(),
    )
    resp.raise_for_status()

    return {"message": f"「{title}」を{date}に追加しました"}


def add_persistent_todo(
    title: str,
    time: str = None,
    location: str = None,
) -> dict:
    """持ち越しTODOを追加"""
    payload = {
        "title": title,
        "scheduled_time": time,
        "location": location,
    }
    resp = requests.post(
        f"{API_URL}/persistent-todos",
        json=payload,
        headers=get_auth_headers(),
    )
    resp.raise_for_status()

    return {"message": f"「{title}」を持ち越しTODOに追加しました"}


def get_weekly_kpt() -> dict:
    """今週のKPTを取得"""
    today = datetime.now(JST)
    days_since_sunday = (today.weekday() + 1) % 7
    week_start = (today - timedelta(days=days_since_sunday)).strftime("%Y-%m-%d")

    resp = requests.get(
        f"{API_URL}/reviews/weekly/{week_start}",
        headers=get_auth_headers(),
    )
    resp.raise_for_status()
    review = resp.json()

    kpt_items = review.get("kpt_items", [])
    return {
        "week_start": week_start,
        "keep": [i["content"] for i in kpt_items if i["type"] == "keep"],
        "problem": [i["content"] for i in kpt_items if i["type"] == "problem"],
        "try": [i["content"] for i in kpt_items if i["type"] == "try"],
        "achievement_rate": review.get("achievement_rate", 0),
    }


def add_kpt_item(kpt_type: str, content: str) -> dict:
    """KPTアイテムを追加（kpt_type: keep/problem/try）"""
    resp = requests.get(
        f"{API_URL}/reviews/weekly/current",
        headers=get_auth_headers(),
    )
    resp.raise_for_status()
    review = resp.json()

    review_id = review.get("id")
    kpt_resp = requests.post(
        f"{API_URL}/reviews/weekly/{review_id}/kpt",
        json={"type": kpt_type, "content": content},
        headers=get_auth_headers(),
    )
    kpt_resp.raise_for_status()

    type_label = {"keep": "Keep", "problem": "Problem", "try": "Try"}.get(
        kpt_type, kpt_type
    )
    return {"message": f"{type_label}に「{content}」を追加しました"}


def get_monthly_stats() -> dict:
    """今月の達成率を取得"""
    now = datetime.now(JST)
    year_month = f"{now.year:04d}-{now.month:02d}"

    resp = requests.get(
        f"{API_URL}/reviews/monthly/{year_month}/stats",
        headers=get_auth_headers(),
    )
    resp.raise_for_status()
    stats = resp.json()

    return {
        "year_month": year_month,
        "overall_rate": stats.get("overall_rate", 0),
        "streak": stats.get("streak", 0),
        "weekly_rates": stats.get("weekly_rates", []),
    }


def get_today_summary() -> dict:
    """今日のサマリーを取得（習慣・TODO・持ち越し）"""
    habits = get_today_habits()

    persistent_resp = requests.get(
        f"{API_URL}/persistent-todos",
        headers=get_auth_headers(),
    )
    persistent_resp.raise_for_status()

    scheduled_resp = requests.get(
        f"{API_URL}/scheduled-todos/today",
        headers=get_auth_headers(),
    )
    scheduled_resp.raise_for_status()

    return {
        "habits": habits,
        "persistent_todos": persistent_resp.json(),
        "scheduled_todos": scheduled_resp.json(),
    }

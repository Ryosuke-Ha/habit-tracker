import os
from datetime import datetime, timedelta, timezone, time

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

import models
from auth import verify_api_key
from database import SessionLocal

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(verify_api_key)])

JST = timezone(timedelta(hours=9))

VALID_OFFSETS = {"on_time", "30min_before", "1hour_before", "2hour_before", "1day_before", "2day_before"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def calc_notification_datetime(scheduled_date, scheduled_time_str, offset):
    if scheduled_time_str is None and offset in ("on_time", "30min_before", "1hour_before", "2hour_before"):
        return None
    t = time(0, 0)
    if scheduled_time_str:
        parts = scheduled_time_str.split(":")
        t = time(int(parts[0]), int(parts[1]))
    base_dt = datetime.combine(scheduled_date, t, JST)
    if offset == "on_time":
        return base_dt
    elif offset == "30min_before":
        return base_dt - timedelta(minutes=30)
    elif offset == "1hour_before":
        return base_dt - timedelta(hours=1)
    elif offset == "2hour_before":
        return base_dt - timedelta(hours=2)
    elif offset == "1day_before":
        return base_dt - timedelta(days=1)
    elif offset == "2day_before":
        return base_dt - timedelta(days=2)
    return None


def send_slack_notification(todo: models.ScheduledTodo):
    try:
        from slack_sdk import WebClient
        token = os.getenv("SLACK_BOT_TOKEN")
        channel = os.getenv("SLACK_NOTIFY_CHANNEL")
        print(f"SLACK_BOT_TOKEN exists: {bool(token)}")
        print(f"Sending Slack notification to channel: {channel}")
        if not token or not channel:
            return False
        client = WebClient(token=token)
        time_str = todo.scheduled_time or "未設定"
        location_str = todo.location or "未設定"
        date_str = str(todo.scheduled_date)
        text = f"📝 TODOメモ通知\n{todo.title}\n🕐 {time_str} | 📍 {location_str}\n📅 {date_str}"
        try:
            response = client.chat_postMessage(channel=channel, text=text)
            print(f"Slack response: ok={response['ok']}, error={response.get('error', 'none')}")
        except Exception as e:
            print(f"Slack error: {type(e).__name__}: {str(e)}")
            return False
        return True
    except Exception:
        return False


@router.post("/check")
def check_notifications(
    x_internal_key: str = Header(None, alias="X-Internal-Key"),
    db: Session = Depends(get_db),
):
    internal_key = os.getenv("INTERNAL_API_KEY")
    if not internal_key or x_internal_key != internal_key:
        raise HTTPException(status_code=401, detail="Unauthorized")

    now = datetime.now(JST)

    todos = db.query(models.ScheduledTodo).filter(
        models.ScheduledTodo.is_completed == False,  # noqa: E712
        (
            (models.ScheduledTodo.notification_offset_1 != None)    # noqa: E711
            & (models.ScheduledTodo.notification_sent_1 == False)   # noqa: E712
        )
        | (
            (models.ScheduledTodo.notification_offset_2 != None)    # noqa: E711
            & (models.ScheduledTodo.notification_sent_2 == False)   # noqa: E712
        )
    ).all()

    sent_count = 0
    for todo in todos:
        if todo.notification_offset_1 and not todo.notification_sent_1:
            notification_dt = calc_notification_datetime(
                todo.scheduled_date, todo.scheduled_time, todo.notification_offset_1
            )
            print(
                f"Checking: {todo.title}, date: {todo.scheduled_date}, "
                f"notification_dt: {notification_dt}, now: {now.strftime('%Y-%m-%d %H:%M')}, "
                f"will_send: {notification_dt is not None and notification_dt <= now}"
            )
            if notification_dt and notification_dt <= now:
                if send_slack_notification(todo):
                    todo.notification_sent_1 = True
                    todo.updated_at = datetime.utcnow()
                    sent_count += 1

        if todo.notification_offset_2 and not todo.notification_sent_2:
            notification_dt = calc_notification_datetime(
                todo.scheduled_date, todo.scheduled_time, todo.notification_offset_2
            )
            print(
                f"Checking: {todo.title}, date: {todo.scheduled_date}, "
                f"notification_dt: {notification_dt}, now: {now.strftime('%Y-%m-%d %H:%M')}, "
                f"will_send: {notification_dt is not None and notification_dt <= now}"
            )
            if notification_dt and notification_dt <= now:
                if send_slack_notification(todo):
                    todo.notification_sent_2 = True
                    todo.updated_at = datetime.utcnow()
                    sent_count += 1

    db.commit()
    return {"sent": sent_count}

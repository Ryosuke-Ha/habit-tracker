import threading

from slack_bolt import App

from config import SLACK_CHANNEL_ID


def register_handlers(app: App, orchestrator) -> None:
    @app.event("message")
    def handle_message(event, logger):
        # Only process messages from the target channel
        if event.get("channel") != SLACK_CHANNEL_ID:
            return

        # Ignore bot messages and message edits/deletions
        if event.get("bot_id") or event.get("subtype"):
            return

        text = event.get("text", "").strip()
        if not text:
            return

        channel = event["channel"]
        ts = event["ts"]

        thread = threading.Thread(
            target=_run_safe,
            args=(orchestrator, text, channel, ts),
            daemon=True,
        )
        thread.start()


def _run_safe(orchestrator, text: str, channel: str, ts: str) -> None:
    try:
        orchestrator.run(text, channel, ts)
    except Exception as e:
        try:
            orchestrator.slack_client.chat_postMessage(
                channel=channel,
                text=f"❌ 予期しないエラー: {e}",
                thread_ts=ts,
            )
        except Exception:
            pass

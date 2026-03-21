import logging

from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

from agent.orchestrator import Orchestrator
from bot.slack_handler import register_handlers
from config import SLACK_APP_TOKEN, SLACK_BOT_TOKEN
from github_client import GitHubClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = App(token=SLACK_BOT_TOKEN)
github = GitHubClient()
orchestrator = Orchestrator(github_client=github, slack_client=app.client)

register_handlers(app, orchestrator)

if __name__ == "__main__":
    handler = SocketModeHandler(app, SLACK_APP_TOKEN)
    logging.info("⚡ Slack Auto-Fix Bot starting...")
    handler.start()

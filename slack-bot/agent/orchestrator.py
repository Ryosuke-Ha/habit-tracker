import json

import anthropic

from agent.tools import TOOLS
from config import ANTHROPIC_API_KEY

SYSTEM_PROMPT = """あなたはhabit-trackerアプリの自動修正エージェントです。
ユーザーからの要望を受け取り、以下のステップで作業を進めてください。

1. まず関連するファイルを調査する
2. 修正方針をSlackに報告する
3. 新しいブランチを作成する（fix/[内容]またはfeat/[内容]）
4. ファイルを修正してコミットする
5. PRを作成してSlackに通知する
6. CIのステータスを確認する（最大10分間ポーリング）
7. CIが通ったら自動マージする
8. 完了をSlackに報告する

作業中は日本語でSlackに進捗を報告してください。
エラーが発生した場合は即座にSlackに報告して作業を停止してください。

CIのステータス確認は30秒待機してから行い、最大20回（10分）繰り返してください。
ブランチ名は fix/YYYYMMDD-HHMMSS または feat/YYYYMMDD-HHMMSS の形式を使用してください。"""

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 8096
CI_POLL_INTERVAL_SECONDS = 30
CI_MAX_POLLS = 20


class Orchestrator:
    def __init__(self, github_client, slack_client):
        self.github = github_client
        self.slack_client = slack_client
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def run(self, user_message: str, channel_id: str, thread_ts: str) -> None:
        self._channel_id = channel_id
        self._thread_ts = thread_ts
        messages = [{"role": "user", "content": user_message}]

        try:
            while True:
                response = self.client.messages.create(
                    model=MODEL,
                    max_tokens=MAX_TOKENS,
                    system=SYSTEM_PROMPT,
                    tools=TOOLS,
                    messages=messages,
                )

                messages.append({"role": "assistant", "content": response.content})

                if response.stop_reason == "end_turn":
                    for block in response.content:
                        if hasattr(block, "text") and block.text:
                            self._post(block.text)
                    break

                if response.stop_reason == "tool_use":
                    tool_results = []
                    for block in response.content:
                        if block.type == "tool_use":
                            result = self._execute_tool(block.name, block.input)
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": json.dumps(result, ensure_ascii=False),
                            })
                    messages.append({"role": "user", "content": tool_results})
                else:
                    break

        except Exception as e:
            self._post(f"❌ エラーが発生しました: {e}")
            raise

    def _post(self, message: str) -> None:
        self.slack_client.chat_postMessage(
            channel=self._channel_id,
            text=message,
            thread_ts=self._thread_ts,
        )

    def _execute_tool(self, name: str, params: dict) -> dict:
        import time

        try:
            if name == "get_file_content":
                return self.github.get_file_content(params["file_path"])

            elif name == "list_files":
                return self.github.list_files(params["directory"])

            elif name == "search_code":
                return self.github.search_code(params["query"])

            elif name == "create_branch":
                return self.github.create_branch(params["branch_name"])

            elif name == "create_or_update_file":
                return self.github.create_or_update_file(
                    params["file_path"],
                    params["content"],
                    params["commit_message"],
                    params["branch"],
                )

            elif name == "create_pull_request":
                return self.github.create_pull_request(
                    params["title"],
                    params["body"],
                    params["branch"],
                )

            elif name == "get_pr_status":
                # Wait before polling to give CI time to register
                time.sleep(CI_POLL_INTERVAL_SECONDS)
                return self.github.get_pr_status(params["pr_number"])

            elif name == "merge_pull_request":
                return self.github.merge_pull_request(params["pr_number"])

            elif name == "post_slack_message":
                self._post(params["message"])
                return {"ok": True}

            else:
                return {"error": f"Unknown tool: {name}"}

        except Exception as e:
            return {"error": str(e)}

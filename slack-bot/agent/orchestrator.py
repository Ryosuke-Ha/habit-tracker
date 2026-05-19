import json

import anthropic

import habit_tools
from agent.tools import GITHUB_TOOLS, HABIT_TOOLS
from config import ANTHROPIC_API_KEY

SYSTEM_PROMPT = """あなたはhabit-trackerの自律型エージェントです。
ユーザーからの要望を受け取ったら、人間の確認や追加指示を一切待たずに、
ツールを使って自律的に実行してください。

【重要ルール】
- 絶対にユーザーへの確認や承認を求めないこと
- テキストで回答するのは全ステップ完了後の最終報告のみ
- 進捗報告は必ず post_slack_message ツールを使うこと（テキスト出力は不可）
- エラーが発生した場合のみ post_slack_message で報告して作業を停止すること

【タスクの種別】
1. データ操作タスク（習慣・TODO・振り返り）
   「習慣をチェック」「達成率を確認」「TODOを追加」「KPTを見せて」など
   → HABIT_TOOLSを使用し、結果を日本語でSlackに報告する

2. コード修正タスク（バグ修正・機能追加）
   「バグを直して」「機能を追加して」などの開発関連
   → 以下のステップを全て完遂すること:
   1. list_files / get_file_content / search_code で関連ファイルを調査する
   2. post_slack_message で修正方針を報告する（ここで止まらず即座に次へ進む）
   3. create_branch でブランチを作成する（fix/YYYYMMDD-HHMMSS または feat/YYYYMMDD-HHMMSS）
   4. create_or_update_file でファイルを修正してコミットする
   5. create_pull_request でPRを作成し、post_slack_message でURLを報告する
   6. get_pr_status でCIステータスを確認する（pending なら再度呼び出す、最大20回）
   7. CIが success になったら merge_pull_request でマージする
   8. post_slack_message で完了を報告する

【CIポーリング】
- get_pr_status は1回呼ぶたびに30秒待機してから結果を返す
- ci_status が "pending" の間は get_pr_status を繰り返し呼び続ける
- ci_status が "success" になったら merge_pull_request を実行する
- ci_status が "failure" になったら post_slack_message でエラーを報告して停止する"""

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 8096
CI_POLL_INTERVAL_SECONDS = 30
CI_MAX_POLLS = 20

ALL_TOOLS = GITHUB_TOOLS + HABIT_TOOLS


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
                    tools=ALL_TOOLS,
                    messages=messages,
                )

                messages.append({"role": "assistant", "content": response.content})

                if response.stop_reason == "end_turn":
                    # 最終完了メッセージのみテキストで投稿
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
                    # tool_use の後は必ずループを継続する（break しない）
                    continue

                # それ以外の stop_reason（max_tokens など）は終了
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

            elif name == "get_today_habits":
                return habit_tools.get_today_habits()

            elif name == "check_habit":
                return habit_tools.check_habit(params["habit_title"])

            elif name == "get_achievement_rate":
                return habit_tools.get_achievement_rate()

            elif name == "add_scheduled_todo":
                return habit_tools.add_scheduled_todo(
                    params["title"],
                    params["date"],
                    params.get("time"),
                    params.get("location"),
                )

            elif name == "add_persistent_todo":
                return habit_tools.add_persistent_todo(
                    params["title"],
                    params.get("time"),
                    params.get("location"),
                )

            elif name == "get_weekly_kpt":
                return habit_tools.get_weekly_kpt()

            elif name == "add_kpt_item":
                return habit_tools.add_kpt_item(
                    params["kpt_type"],
                    params["content"],
                )

            elif name == "get_monthly_stats":
                return habit_tools.get_monthly_stats()

            elif name == "get_today_summary":
                return habit_tools.get_today_summary()

            else:
                return {"error": f"Unknown tool: {name}"}

        except Exception as e:
            return {"error": str(e)}

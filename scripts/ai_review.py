import os
import subprocess

import anthropic
from github import Github

MAX_DIFF_CHARS = 50000

ADVERSARIAL_SYSTEM_PROMPT = """
You are a hostile code reviewer. Your job is NOT to be helpful.
Your job is to find everything wrong with this code change.

Review this diff adversarially for:
1. Correctness — will this actually work in all cases?
2. Simplicity — is this more complex than it needs to be?
3. Hidden assumptions — what does this code assume that could be wrong?
4. Edge cases — what inputs or states would break this?
5. Security — what could an attacker exploit?

You have NO context about why this change was made.
You have NOT seen the conversation that produced it.
Treat every design decision as potentially wrong until proven otherwise.

Output in this exact format:

## ⚔️ Adversarial Review

### Assumptions Made
{list assumptions embedded in the code — be specific about line numbers}

### Design Decisions (and why they might be wrong)
{list decisions with counterarguments}

### Correctness Concerns
{specific bugs or logic errors — reference line numbers where possible}

### Simplicity Issues
{unnecessary complexity, over-engineering, or abstraction}

### Where to Focus Your Review
{top 3 specific things the human should read carefully, with line references}

If there are no significant concerns in a category, write "None found."
"""


def get_pr_diff() -> str:
    """PRの差分を取得する"""
    base_sha = os.environ.get("BASE_SHA", "")
    head_sha = os.environ.get("HEAD_SHA", "")

    # BASE_SHAが空の場合（初回open時）はmainブランチとの差分を取得
    if not base_sha:
        base_sha = subprocess.run(
            ["git", "merge-base", "HEAD", "origin/main"],
            capture_output=True, text=True
        ).stdout.strip()

    if not base_sha or not head_sha:
        return ""

    result = subprocess.run(
        [
            "git", "diff", f"{base_sha}...{head_sha}",
            "--",
            "frontend/", "backend/", "mobile/", "slack-bot/",
            ":!**/node_modules/**", ":!**/venv/**", ":!**/*.lock",
            ":!**/*.coverage", ":!**/tsconfig.tsbuildinfo",
        ],
        capture_output=True,
        text=True,
    )

    diff = result.stdout
    if len(diff) > MAX_DIFF_CHARS:
        diff = diff[:MAX_DIFF_CHARS] + "\n\n... (差分が大きいため省略)"

    return diff


def review_with_claude(diff: str) -> str:
    """Claudeにコードレビューを依頼する"""
    if not diff.strip():
        return "変更されたファイルがありません。"

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    system_prompt = """
あなたはhabit-trackerプロジェクトのシニアエンジニアです。
PRの差分をレビューして、以下の観点でフィードバックを提供してください。

## レビュー観点

### 必須チェック
1. **セキュリティ**: 機密情報のハードコード・SQLインジェクション・認証バイパスの可能性
2. **CLAUDE.mdルール違反**: 以下を確認
   - routerにDBクエリが直書きされていないか
   - plain strでEnum値を使っていないか
   - anyを使っていないか（TypeScript）
   - JSTで日付計算しているか
   - font-sizeが16px以上か（モバイル）
3. **バグ**: 明らかなロジックエラー・null参照・型の不一致

### 品質チェック
4. **設計**: ビジネスロジックがAPIレイヤーに集中しているか
5. **テスト**: 重要な変更にテストが追加されているか
6. **パフォーマンス**: 不要なループ・N+1クエリの可能性

## 出力形式

### ✅ 良い点
変更の良い点を簡潔に記載

### ⚠️ 要確認
修正を推奨する問題点（あれば）

### 🔴 必須修正
マージ前に必ず修正すべき問題（あれば）

### 💡 提案
任意の改善提案（あれば）

---
問題がない場合は「✅ 問題なし - マージ可能です」とだけ返してください。
日本語で回答してください。
レビューは簡潔に、重要な点のみ指摘してください。
"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": (
                    f"以下のPR差分をレビューしてください:\n\n```diff\n{diff}\n```"
                ),
            }
        ],
    )

    return message.content[0].text


def adversarial_review_with_claude(diff: str) -> str:
    """
    会話履歴を持たないサブエージェントによる敵対的レビュー。
    メインセッションの盲点を排除するため、独立したAPIコールで実行する。
    """
    if not diff.strip():
        return "No changes to review."

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    review_diff = diff
    if len(diff) > 30000:
        review_diff = diff[:30000] + "\n\n... (diff truncated for length)"

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=ADVERSARIAL_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Review this code change adversarially:\n\n"
                    f"```diff\n{review_diff}\n```"
                ),
            }
        ],
    )

    return message.content[0].text


def post_review_comment(standard_review: str, adversarial_review: str) -> None:
    """通常レビューと敵対的レビューの両方をPRにコメントとして投稿する"""
    g = Github(os.environ["GITHUB_TOKEN"])
    repo = g.get_repo(os.environ["REPO_NAME"])
    pr = repo.get_pull(int(os.environ["PR_NUMBER"]))

    comment_body = (
        "## \U0001f916 AI Code Review\n\n"
        "### \u2705 Standard Review\n\n"
        f"{standard_review}\n\n"
        "---\n\n"
        "### \u2694\ufe0f Adversarial Review (Subagent)\n\n"
        "> This agent has no conversation history and no context about "
        "why this change was made.\n"
        "> It reviews only the code, without assumptions from the main "
        "session.\n\n"
        f"{adversarial_review}\n\n"
        "---\n"
        "*Standard review by Claude Haiku \u00b7 "
        "Adversarial review by Claude Sonnet (independent session)*\n"
    )

    for comment in pr.get_issue_comments():
        if "\U0001f916 AI Code Review" in comment.body:
            comment.delete()

    pr.create_issue_comment(comment_body)
    print("レビューコメントを投稿しました")


def main() -> None:
    print("差分を取得中...")
    diff = get_pr_diff()

    if not diff.strip():
        print("差分なし - スキップ")
        return

    print(f"差分サイズ: {len(diff)}文字")

    print("Claudeで通常レビュー中...")
    try:
        standard_review = review_with_claude(diff)
    except anthropic.BadRequestError as e:
        print(f"API BadRequestError: {e}")
        standard_review = "⚠️ AIレビューをスキップしました（APIリクエストエラー）"
    except anthropic.APIStatusError as e:
        print(f"API StatusError: {e}")
        standard_review = "⚠️ AIレビューをスキップしました（APIエラー）"
    except Exception as e:
        print(f"予期しないエラー: {e}")
        standard_review = "⚠️ AIレビューをスキップしました（予期しないエラー）"

    print("敵対的サブエージェントでレビュー中...")
    try:
        adversarial_review = adversarial_review_with_claude(diff)
    except anthropic.BadRequestError as e:
        print(f"Adversarial API BadRequestError: {e}")
        adversarial_review = "⚠️ 敵対的レビューをスキップしました（APIリクエストエラー）"
    except anthropic.APIStatusError as e:
        print(f"Adversarial API StatusError: {e}")
        adversarial_review = "⚠️ 敵対的レビューをスキップしました（APIエラー）"
    except Exception as e:
        print(f"Adversarial 予期しないエラー: {e}")
        adversarial_review = "⚠️ 敵対的レビューをスキップしました（予期しないエラー）"

    print("PRにコメントを投稿中...")
    post_review_comment(standard_review, adversarial_review)

    print("完了!")


if __name__ == "__main__":
    main()

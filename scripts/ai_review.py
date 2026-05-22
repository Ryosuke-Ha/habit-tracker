import os
import subprocess

import anthropic
from github import Github

MAX_DIFF_CHARS = 20000


def get_pr_diff() -> str:
    """PRの差分を取得する"""
    base_sha = os.environ["BASE_SHA"]
    head_sha = os.environ["HEAD_SHA"]

    result = subprocess.run(
        [
            "git", "diff", f"{base_sha}..{head_sha}",
            "--",
            "frontend/", "backend/", "mobile/", "slack-bot/",
            ":!**/node_modules/**", ":!**/venv/**", ":!**/*.lock",
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


def post_review_comment(review: str) -> None:
    """レビュー結果をPRにコメントとして投稿する"""
    g = Github(os.environ["GITHUB_TOKEN"])
    repo = g.get_repo(os.environ["REPO_NAME"])
    pr = repo.get_pull(int(os.environ["PR_NUMBER"]))

    comment_body = (
        "## \U0001f916 AI Code Review\n\n"
        f"{review}\n\n"
        "---\n"
        "*このレビューはClaude Haiku by Anthropicが自動生成しました*\n"
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
    print("Claudeでレビュー中...")
    try:
        review = review_with_claude(diff)
    except anthropic.BadRequestError as e:
        print(f"API BadRequestError: {e}")
        review = "⚠️ AIレビューをスキップしました（APIリクエストエラー）"
    except anthropic.APIStatusError as e:
        print(f"API StatusError: {e}")
        review = "⚠️ AIレビューをスキップしました（APIエラー）"
    except Exception as e:
        print(f"予期しないエラー: {e}")
        review = "⚠️ AIレビューをスキップしました（予期しないエラー）"

    print("PRにコメントを投稿中...")
    post_review_comment(review)

    print("完了!")


if __name__ == "__main__":
    main()

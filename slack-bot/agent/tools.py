TOOLS = [
    {
        "name": "get_file_content",
        "description": "GitHubリポジトリから指定ファイルの内容を取得",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "取得するファイルのパス（例: frontend/app/page.tsx）",
                }
            },
            "required": ["file_path"],
        },
    },
    {
        "name": "list_files",
        "description": "指定ディレクトリのファイル一覧を取得",
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {
                    "type": "string",
                    "description": "一覧を取得するディレクトリパス（例: frontend/app）",
                }
            },
            "required": ["directory"],
        },
    },
    {
        "name": "search_code",
        "description": "リポジトリ内のコードを検索",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "検索クエリ（例: useState, TODO, API_URL）",
                }
            },
            "required": ["query"],
        },
    },
    {
        "name": "create_or_update_file",
        "description": "ファイルを作成または更新してコミット",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "作成・更新するファイルのパス",
                },
                "content": {
                    "type": "string",
                    "description": "ファイルの内容（全文）",
                },
                "commit_message": {
                    "type": "string",
                    "description": "コミットメッセージ",
                },
                "branch": {
                    "type": "string",
                    "description": "コミット先のブランチ名",
                },
            },
            "required": ["file_path", "content", "commit_message", "branch"],
        },
    },
    {
        "name": "create_branch",
        "description": "新しいブランチを作成（mainから分岐）",
        "input_schema": {
            "type": "object",
            "properties": {
                "branch_name": {
                    "type": "string",
                    "description": "作成するブランチ名（例: fix/20240321-123456）",
                }
            },
            "required": ["branch_name"],
        },
    },
    {
        "name": "create_pull_request",
        "description": "プルリクエストを作成",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "PRのタイトル",
                },
                "body": {
                    "type": "string",
                    "description": "PRの説明（変更内容・影響範囲）",
                },
                "branch": {
                    "type": "string",
                    "description": "PRのソースブランチ名",
                },
            },
            "required": ["title", "body", "branch"],
        },
    },
    {
        "name": "get_pr_status",
        "description": "PRのCIステータスを確認（pending/success/failure）",
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {
                    "type": "integer",
                    "description": "PRの番号",
                }
            },
            "required": ["pr_number"],
        },
    },
    {
        "name": "merge_pull_request",
        "description": "PRをsquashマージ",
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {
                    "type": "integer",
                    "description": "マージするPRの番号",
                }
            },
            "required": ["pr_number"],
        },
    },
    {
        "name": "post_slack_message",
        "description": "Slackに進捗を報告",
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "送信するメッセージ（日本語で）",
                }
            },
            "required": ["message"],
        },
    },
]

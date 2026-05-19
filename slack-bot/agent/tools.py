GITHUB_TOOLS = [
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

HABIT_TOOLS = [
    {
        "name": "get_today_habits",
        "description": "今日の習慣一覧を取得する。今日やること、習慣リストを確認する場合に使う。",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "check_habit",
        "description": "習慣名を指定してチェックする。「筋トレをチェック」「英語学習を完了」などの場合に使う。",
        "input_schema": {
            "type": "object",
            "properties": {
                "habit_title": {
                    "type": "string",
                    "description": "チェックする習慣のタイトル（部分一致で検索）",
                }
            },
            "required": ["habit_title"],
        },
    },
    {
        "name": "get_achievement_rate",
        "description": "今週の習慣達成率を取得する。先週比・最強/最弱習慣も含む。",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "add_scheduled_todo",
        "description": "特定の日付のTODOメモを追加する。「明日の歯医者」「来週の会議」などの場合に使う。",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "TODOのタイトル"},
                "date": {"type": "string", "description": "日付（YYYY-MM-DD形式）"},
                "time": {"type": "string", "description": "時刻（HH:MM形式、任意）"},
                "location": {"type": "string", "description": "場所（任意）"},
            },
            "required": ["title", "date"],
        },
    },
    {
        "name": "add_persistent_todo",
        "description": "完了するまで毎日表示される持ち越しTODOを追加する。「〇〇をやること」などの場合に使う。",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "TODOのタイトル"},
                "time": {"type": "string", "description": "時刻（HH:MM形式、任意）"},
                "location": {"type": "string", "description": "場所（任意）"},
            },
            "required": ["title"],
        },
    },
    {
        "name": "get_weekly_kpt",
        "description": "今週のKPT（Keep/Problem/Try）振り返りを取得する。",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "add_kpt_item",
        "description": "今週のKPTにアイテムを追加する。「Keepに〇〇を追加」などの場合に使う。",
        "input_schema": {
            "type": "object",
            "properties": {
                "kpt_type": {
                    "type": "string",
                    "enum": ["keep", "problem", "try"],
                    "description": "KPTの種別",
                },
                "content": {"type": "string", "description": "追加する内容"},
            },
            "required": ["kpt_type", "content"],
        },
    },
    {
        "name": "get_monthly_stats",
        "description": "今月の達成率・streak・週ごとの達成率を取得する。",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_today_summary",
        "description": "今日のサマリーを取得する。習慣・TODO・持ち越しTODOを一覧表示する場合に使う。",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]

# 習慣トラッカー MVP

Atomic Habitsの「実施意図」に基づいた習慣管理Webアプリ。

## 構成

- **Frontend**: Next.js 14 (TypeScript, App Router, Tailwind CSS) — port 3000
- **Backend**: FastAPI (Python 3.12, SQLite) — port 8000

---

## セットアップ & 起動手順

### 1. バックエンド

```bash
cd backend

# 仮想環境を作成（初回のみ）
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存パッケージをインストール（初回のみ）
pip install -r requirements.txt

# サーバー起動
uvicorn main:app --reload
```

起動すると自動的にSQLiteのDBが作成され、初期データ（平日・休日テンプレート）が投入されます。

API ドキュメント: http://localhost:8000/docs

---

### 2. フロントエンド（環境変数の設定）

```bash
cd frontend

# .env.local を作成して認証情報を設定
cp .env.example .env.local
```

`.env.local` を編集して以下を設定:

| 変数名 | 取得方法 |
|--------|---------|
| `GOOGLE_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com/) でOAuth 2.0クライアントIDを作成 |
| `GOOGLE_CLIENT_SECRET` | 同上 |
| `NEXTAUTH_SECRET` | 下記コマンドで生成 |
| `NEXTAUTH_URL` | `http://localhost:3000`（デフォルト値のまま） |

**NEXTAUTH_SECRET の生成:**
```bash
openssl rand -base64 32
```
生成された文字列を `NEXTAUTH_SECRET=` に設定してください。

**Google OAuth 設定:**
- 承認済みリダイレクトURI: `http://localhost:3000/api/auth/callback/google`

---

### 3. フロントエンド起動

別ターミナルで:

```bash
cd frontend

# 依存パッケージをインストール（初回のみ）
npm install

# 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

---

## 使い方

1. トップ画面で「平日」or「休日」を選択
2. 習慣一覧が表示される
3. 丸ボタンをクリックしてチェック/アンチェック（即時保存）
4. 下部フォームから新しい習慣を追加（何を・いつ・どこで）
5. ゴミ箱アイコンから習慣を削除

---

## API エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | /templates | テンプレート一覧 |
| GET | /templates/{id}/habits | テンプレートの習慣一覧 |
| POST | /habits | 習慣追加 |
| DELETE | /habits/{id} | 習慣削除 |
| GET | /logs/today?template_id={id} | 今日のチェック状態 |
| POST | /logs/{habit_id}/toggle | チェック切り替え |

---

## ディレクトリ構成

```
habit-tracker/
├── frontend/
│   ├── app/
│   │   ├── page.tsx               # テンプレート選択画面
│   │   ├── habits/page.tsx        # 習慣一覧画面
│   │   └── layout.tsx
│   └── components/
│       ├── TemplateSelector.tsx   # 平日・休日選択
│       ├── HabitList.tsx          # 習慣一覧
│       ├── HabitItem.tsx          # 習慣1件
│       └── AddHabitForm.tsx       # 習慣追加フォーム
├── backend/
│   ├── main.py                    # FastAPIアプリ + seed
│   ├── models.py                  # SQLAlchemyモデル
│   ├── database.py                # DB接続設定
│   ├── requirements.txt
│   └── routers/
│       ├── templates.py           # /templates エンドポイント
│       └── habits.py              # /habits, /logs エンドポイント
└── README.md
```

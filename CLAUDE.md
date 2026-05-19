# CLAUDE.md

This file provides guidance to Claude Code when working with the habit-tracker repository.

## Project Overview

habit-tracker is an Atomic Habits-based habit management web app with AI coaching features.

**Core philosophy**: Business logic lives in the API layer. The database stores data only. AI receives pre-processed context, not raw data.

**Tech Stack**:
- Frontend: Next.js 14 (TypeScript, App Router) + Tailwind CSS
- Backend: FastAPI (Python 3.11) + SQLAlchemy + Alembic
- Database: PostgreSQL (Supabase)
- Mobile: React Native (Expo SDK 54)
- Infrastructure: Vercel (Frontend) + Railway (Backend + Slack Bot)
- AI: Anthropic Claude API

## Key Commands

### Backend
```
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0   # Start development server
pytest                                       # Run tests
flake8 .                                     # Lint
alembic upgrade head                         # Apply migrations
alembic revision --autogenerate -m "desc"   # Create new migration
```

### Frontend
```
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run type-check   # TypeScript check
```

### Mobile
```
cd mobile
npx expo start       # Start Expo development server
npx expo start --clear  # Start with cache cleared
```

**IMPORTANT**: After modifying backend code, always run `flake8 .` before committing.
**IMPORTANT**: After modifying frontend code, always run `npm run type-check` before committing.
**IMPORTANT**: Never commit `.env`, `.env.local`, `backend/.env` files.
**IMPORTANT**: Never hardcode API URLs. Always use environment variables.

## Architecture

### API Design Principle
APIs must contain business logic. Do NOT return raw database records directly.
Pre-process and aggregate data before returning to clients.

**Bad example**:
```
GET /logs/today → returns all DailyLog records as-is
```

**Good example**:
```
GET /logs/today → calculates achievement rate, sorts by time, filters completed items
```

### AI Context Principle
When passing data to Claude API, always pre-process it.
Pass aggregated/summarized data, NOT raw database records.
This reduces token consumption and improves response quality.

### Authentication
- Web: NextAuth.js (Google OAuth)
- Mobile: X-User-Email header (temporary, for development only)
- Internal APIs: X-Internal-Key header

### Database
- ORM: SQLAlchemy with Alembic migrations
- All schema changes must go through Alembic migrations
- Never modify the database schema directly

## Directory Structure

| Path | Purpose |
|------|---------|
| frontend/app/ | Next.js App Router pages |
| frontend/components/ | Reusable React components |
| frontend/hooks/ | Custom React hooks |
| backend/routers/ | FastAPI route handlers |
| backend/models.py | SQLAlchemy models |
| backend/database.py | Database connection |
| backend/alembic/ | Database migrations |
| mobile/app/ | Expo Router pages |
| mobile/components/ | React Native components |
| slack-bot/ | Slack Auto-Fix Bot |
| scripts/ | Utility scripts (doc update, notifications) |
| .github/workflows/ | GitHub Actions CI/CD |

## Coding Rules

### Python (Backend)
- Follow PEP8
- Use type hints for all function arguments and return values
- Use JST (UTC+9) for all datetime calculations, never UTC
- Always use try/except for external API calls (Slack, Anthropic)
- Log errors with sufficient context (user_id, endpoint, error message)

### TypeScript (Frontend/Mobile)
- strict mode is enabled, never use `any`
- Use optimistic UI for all user interactions (check, add, delete)
- Always handle loading and error states
- Font size must be 16px or larger on mobile (prevents iOS auto-zoom)

### Security Rules
- Never write secrets in code. Use environment variables only.
- Validate all external inputs before processing
- The X-User-Email authentication is for development only.
  Must be replaced with proper JWT authentication before public release.

## Common Pitfalls

- **Timezone**: Server runs on UTC. Always convert to JST for date calculations.
- **Mobile API URL**: Must use PC's local IP (not localhost) when testing on device.
- **Git diverged branches**: Run `git config pull.rebase false` then `git pull`.
- **Supabase paused**: Free tier pauses after inactivity. Check dashboard if DB connection fails.
- **flake8 E402**: All imports must be at the top of the file.
- **iOS zoom**: Input elements must have font-size >= 16px.

## Environment Variables

See `.env.example` files in each directory for required variables.
Never commit actual values. Use Railway/Vercel dashboard for production secrets.

## Development Workflow

### Branch Strategy
- main: production branch（直接push禁止）
- feature/issue-{番号}-{概要}: 新機能
- fix/issue-{番号}-{概要}: バグ修正
- refactor/issue-{番号}-{概要}: リファクタリング

### Flow
1. GitHub Issueを作成（要件定義・設計・工数見積もり）
2. ブランチを作成: feature/issue-{番号}-{概要}
3. 実装（Claude Codeに「Issue #〇〇を実装して」と投げる）
4. PRを作成（Issueと紐づけ: closes #〇〇）
5. CIが通ることを確認
6. mainへマージ → 自動デプロイ

### When to Skip Full Flow
軽微な修正（設計書更新不要）:
- UIの微調整・文言変更
- バグ修正（影響範囲が明確）
- テストの追加

フルフロー必須:
- 新しいAPIエンドポイント
- DBスキーマの変更
- 複数コンポーネントにまたがる変更

### Claude Code Usage
実装時は以下の形式でClaude Codeに投げる:
「Issue #〇〇を実装してください。
 設計はIssueのコメントを参照してください。
 CLAUDE.mdのルールに従ってください。」

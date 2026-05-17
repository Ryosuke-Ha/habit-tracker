# Development Guide

## 1. Overview

This document is the day-to-day reference for anyone working on habit-tracker — whether that's a new contributor, a collaborator, or your future self returning after a break. It covers environment setup, project structure, development workflow, testing, deployment, and troubleshooting.

For system design and architecture decisions see [`architecture.md`](./architecture.md).
For API details see [`api.md`](./api.md).
For database schema see [`database.md`](./database.md).

---

## 2. Development Environment Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|--------|
| Node.js | 20+ | Frontend runtime |
| npm | bundled with Node.js | Frontend package manager |
| Python | 3.11+ | Backend runtime |
| Git | any recent version | Version control |
| VS Code | latest | Recommended editor |

### Recommended VS Code Extensions

Install these from the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`) or via the CLI:

```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-python.vscode-pylance
code --install-extension ms-python.python
code --install-extension bradlc.vscode-tailwindcss
code --install-extension eamodio.gitlens
```

| Extension | ID | Purpose |
|-----------|-----|--------|
| ESLint | `dbaeumer.vscode-eslint` | TypeScript/JS linting |
| Prettier | `esbenp.prettier-vscode` | Code formatting |
| Pylance | `ms-python.vscode-pylance` | Python type checking and IntelliSense |
| Python | `ms-python.python` | Python language support |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Autocomplete for Tailwind classes |
| GitLens | `eamodio.gitlens` | Enhanced git blame and history |

### Clone and Setup

#### 1. Clone the repository

```bash
git clone https://github.com/Ryosuke-Ha/habit-tracker.git
cd habit-tracker
```

#### 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local
```

Edit `frontend/.env.local`:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_SECRET=your-nextauth-secret        # generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

#### 3. Backend setup

```bash
cd ../backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=sqlite:///./habit_tracker.db   # local SQLite
FRONTEND_URL=http://localhost:3000
```

#### 4. Run DB migrations

```bash
# Still in backend/ with venv activated
alembic upgrade head
```

#### 5. Start all services

Open three terminal tabs:

```bash
# Tab 1 — Backend (backend/)
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Tab 2 — Frontend (frontend/)
npm run dev

# Tab 3 — Slack Bot (optional, slack-bot/)
source venv/bin/activate
python main.py
```

Open http://localhost:3000 in your browser.

---

## 3. Project Structure

```
habit-tracker/
├── frontend/                   # Next.js 14 application (TypeScript)
│   ├── app/                    # App Router — pages and API routes
│   │   ├── page.tsx            # Daily TODO dashboard (home)
│   │   ├── login/              # Login page
│   │   ├── habits/             # Habit list view
│   │   ├── templates/          # Template management
│   │   ├── review/weekly/      # Weekly KPT review
│   │   ├── review/monthly/     # Monthly review with charts
│   │   └── api/auth/           # NextAuth.js route handler
│   ├── components/             # Reusable React components
│   ├── hooks/                  # Custom React hooks (e.g. useSetting)
│   └── tests/                  # Jest + Testing Library test files
│
├── backend/                    # FastAPI application (Python 3.11)
│   ├── domain/                 # Domain layer
│   │   ├── enums.py            # Domain enumerations (GoalStatus, KPTType, SessionStatus)
│   │   ├── exceptions.py       # Domain exception hierarchy (DomainError and subclasses)
│   │   └── value_objects.py    # Value objects (WeekPeriod, YearMonth, ScheduledTime, AchievementRate)
│   ├── routers/                # One file per resource group
│   │   ├── templates.py
│   │   ├── habits.py
│   │   ├── persistent_todos.py
│   │   ├── subtasks.py
│   │   ├── reviews.py
│   │   ├── monthly_reviews.py
│   │   ├── coaching.py
│   │   └── settings.py
│   ├── main.py                 # App factory, CORS, router registration, global exception handlers
│   ├── models.py               # SQLAlchemy ORM models with domain behavior methods
│   ├── database.py             # Engine, SessionLocal, get_db dependency
│   ├── alembic/                # Migration scripts
│   │   └── versions/           # One .py file per migration
│   └── tests/                  # pytest test files
│       ├── conftest.py         # In-memory SQLite fixtures
│       ├── test_templates.py
│       ├── test_habits.py
│       ├── test_logs.py
│       └── domain/
│           ├── test_value_objects.py  # Unit tests for domain value objects
│           └── test_models.py        # Unit tests for domain model behavior
│
├── slack-bot/                  # Slack Auto-Fix Bot (Python)
│   ├── agent/
│   │   ├── orchestrator.py     # Claude tool-use loop
│   │   └── tools.py            # GitHub + Slack tool definitions
│   ├── bot/
│   │   └── slack_handler.py    # Slack event listener
│   ├── config.py               # Environment variable loading
│   ├── github_client.py        # PyGitHub wrapper
│   └── main.py                 # Entry point (Slack Bolt + Socket Mode)
│
└── docs/                       # Project documentation
    ├── architecture.md         # System architecture and design decisions
    ├── api.md                  # Full API reference
    ├── database.md             # Database schema and migration guide
    └── development.md          # This file
```

---

## 4. Development Workflow

### Branch Strategy

| Branch pattern | Purpose |
|----------------|--------|
| `main` | Production — auto-deploys to Vercel and Railway on merge |
| `feature/[name]` | New features (e.g. `feature/apple-watch-sync`) |
| `fix/[name]` | Bug fixes (e.g. `fix/monthly-chart-timezone`) |
| `docs/[name]` | Documentation updates |

Always branch off `main` and target `main` for PRs.

### Commit Message Convention

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>: <short summary in present tense>
```

| Type | When to use |
|------|------------|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `ci` | CI/CD pipeline changes |
| `refactor` | Code restructure with no behavior change |

**Examples:**

```
feat: add monthly achievement streak counter
fix: correct week boundary calculation for Sunday start
docs: add subtask API examples to api.md
test: add coverage for standalone log toggle
ci: cache pip dependencies in backend workflow
refactor: extract get_or_create_user helper into shared module
```

### Pull Request Process

1. **Create a branch** from `main`

   ```bash
   git checkout main && git pull
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit with a descriptive message

3. **Run tests locally** before pushing (see [Testing](#5-testing))

4. **Push and open a PR**

   ```bash
   git push -u origin feature/your-feature-name
   gh pr create --title "feat: your feature" --body "Description of changes"
   ```

5. **CI runs automatically** — both Frontend CI and Backend CI must pass

6. **Merge to `main`** → Vercel and Railway auto-deploy within minutes

---

## 5. Testing

### Frontend Tests

- **Framework:** Jest + React Testing Library
- **Test environment:** jsdom (browser simulation)
- **Test files:** `frontend/tests/**/*.test.{ts,tsx}`

```bash
cd frontend

# Run all tests (single pass)
npm test -- --watchAll=false

# Run in watch mode during development
npm test

# Run a specific file
npm test -- tests/components/TodoItem.test.tsx
```

Current test files:

| File | What it tests |
|------|---------------|
| `tests/components/TodoItem.test.tsx` | Todo item rendering and check toggle |
| `tests/components/TemplateSelector.test.tsx` | Template picker display and selection |

### Backend Tests

- **Framework:** pytest + pytest-asyncio
- **Test database:** SQLite in-memory (created fresh and torn down for each test)
- **Test files:** `backend/tests/`
- **Coverage:** automatically reported after every run (configured in `pytest.ini`)

```bash
cd backend
source venv/bin/activate

# Run all tests with coverage
pytest

# Run a specific file
pytest tests/test_habits.py

# Run a specific test function
pytest tests/test_habits.py::test_create_habit

# Run domain unit tests only
pytest tests/domain/

# Coverage only (no terminal output for tests)
pytest --cov=. --cov-report=term-missing

# Generate HTML coverage report
pytest --cov=. --cov-report=html
open htmlcov/index.html
```

Current test files:

| File | What it tests |
|------|---------------|
| `tests/test_templates.py` | Template CRUD endpoints |
| `tests/test_habits.py` | Habit CRUD endpoints |
| `tests/test_logs.py` | Daily log creation and toggle |
| `tests/domain/test_value_objects.py` | Domain value objects (`WeekPeriod`, `YearMonth`, `ScheduledTime`, `AchievementRate`) |
| `tests/domain/test_models.py` | Domain model behavior (`CoachingSession`, `CoachingGoal`, `DailyLog`, `WeeklyReview` state transitions and validation) |

The `conftest.py` fixture overrides the `get_db` dependency with an in-memory SQLite session and recreates the schema before each test, so tests are fully isolated with no shared state.

### Linting

```bash
# Frontend — TypeScript type check
cd frontend && npm run type-check

# Backend — flake8 (max line length 120, E501/W503/E741 ignored)
cd backend && flake8 .
```

---

## 6. Database Operations

All commands must be run from the `backend/` directory with the virtualenv activated.

### Apply all pending migrations

```bash
alembic upgrade head
```

### Create a new migration after editing `models.py`

```bash
alembic revision --autogenerate -m "describe your schema change"
```

Review the generated file in `alembic/versions/` before applying — autogenerate can miss server defaults or index names.

### Rollback the most recent migration

```bash
alembic downgrade -1
```

### Rollback to a specific revision

```bash
alembic downgrade ec7ba1b3551b
```

### Check the current applied revision

```bash
alembic current
```

### View migration history

```bash
alembic history --verbose
```

---

## 7. Deployment

### Frontend — Vercel

- **Trigger:** push to `main` (via Vercel GitHub integration)
- **Preview deployments:** every PR automatically gets a unique preview URL
- **Build command:** `npm run build` (runs in `frontend/`)
- **Environment variables:** configure in the Vercel project dashboard under *Settings → Environment Variables*

Required Vercel environment variables:

| Variable | Value source |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Vercel deployment URL |
| `NEXT_PUBLIC_BACKEND_URL` | Railway backend URL |

### Backend — Railway

- **Trigger:** push to `main` (via Railway GitHub integration)
- **Start command:** defined in `backend/Procfile`
- **Environment variables:** configure in the Railway service dashboard under *Variables*
- **Logs:** available in the Railway service dashboard under *Deployments → Logs*

Required Railway environment variables:

| Variable | Value source |
|----------|-------------|
| `DATABASE_URL` | Supabase Transaction Pooler URI |
| `FRONTEND_URL` | Your Vercel deployment URL |

### Slack Bot — Railway

The Slack Bot runs as a **separate Railway service** in the same project.

- **Trigger:** push to `main` (same GitHub integration)
- **Start command:** defined in `slack-bot/Procfile`
- **Environment variables:** set per-service in Railway dashboard

Required environment variables:

| Variable | Value source |
|----------|-------------|
| `SLACK_BOT_TOKEN` | Slack API dashboard (`xoxb-...`) |
| `SLACK_APP_TOKEN` | Slack API dashboard (`xapp-...`) |
| `SLACK_CHANNEL_ID` | Slack channel ID |
| `ANTHROPIC_API_KEY` | Anthropic Console |
| `GITHUB_TOKEN` | GitHub Personal Access Token (`repo` scope) |
| `GITHUB_REPO` | `Ryosuke-Ha/habit-tracker` |

---

## 8. Slack Auto-Fix Bot Usage

### Start the bot locally

```bash
cd slack-bot
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your tokens
python main.py
```

You should see:

```
⚡ Slack Auto-Fix Bot starting...
```

The bot connects to Slack via Socket Mode — no public URL or webhook is required.

### Send a command

Mention the bot in the configured Slack channel (`SLACK_CHANNEL_ID`):

```
@habit-tracker-bot Fix the bug where the weekly chart shows the wrong week start
@habit-tracker-bot Add a button to copy last week's Try items into this week's review
@habit-tracker-bot Refactor the monthly stats endpoint to separate calculation logic into a helper function
@habit-tracker-bot Update the README to mention the new Apple Watch feature
```

### How the bot processes a request

1. **Receives** the Slack message and spawns a background thread
2. **Investigates** the codebase using `get_file_content`, `list_files`, and `search_code` tools
3. **Reports** the fix plan back to Slack before making any changes
4. **Creates** a feature branch (`fix/YYYYMMDD-HHMMSS`)
5. **Commits** the changes with `create_or_update_file`
6. **Opens** a Pull Request and posts the PR URL to Slack
7. **Polls** GitHub Actions CI every 30 seconds (up to 10 minutes)
8. **Merges** the PR automatically when CI passes
9. **Notifies** Slack of completion — Vercel and Railway deploy automatically

---

## 9. Troubleshooting

### Backend fails to start

```
ModuleNotFoundError: No module named 'fastapi'
```

The virtualenv is not activated. Run:

```bash
cd backend
source venv/bin/activate   # Windows: venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

---

### DB connection error on startup

```
sqlalchemy.exc.OperationalError: ...
```

Check that `DATABASE_URL` in `backend/.env` is set correctly:

- **Local:** `sqlite:///./habit_tracker.db`
- **Production:** Supabase Transaction Pooler URI (starts with `postgresql://`)

If using PostgreSQL locally, make sure the database server is running and the credentials are correct.

---

### Alembic migration fails

```
alembic.util.exc.CommandError: Target database is not up to date.
```

Your local DB is behind the latest migrations. Run:

```bash
alembic upgrade head
```

If the error persists, check `alembic current` to see which revision is applied and compare with `alembic history`.

---

### Slack bot not responding

1. Confirm the bot is running (`⚡ Slack Auto-Fix Bot starting...` in logs)
2. Check that `SLACK_BOT_TOKEN` starts with `xoxb-` and `SLACK_APP_TOKEN` starts with `xapp-`
3. Confirm **Socket Mode** is enabled in the Slack app settings
4. Confirm the bot is added to the target channel
5. Check that `SLACK_CHANNEL_ID` matches the channel where you are sending messages

---

### Vercel build fails on CI

The most common cause is a TypeScript error that only surfaces during `next build`. Run locally first:

```bash
cd frontend
npm run type-check   # catches type errors
npm run build        # full production build
```

Fix any reported errors before pushing.

---

### Frontend and backend on diverged git history

```
hint: You have divergent branches and need to specify how to reconcile them.
```

Set the default pull strategy to merge (once per machine):

```bash
git config pull.rebase false
git pull
```

Or rebase instead:

```bash
git pull --rebase
```

---

### CORS error when calling the backend from the frontend

The backend allows requests only from `FRONTEND_URL`. Make sure:

- `backend/.env` → `FRONTEND_URL=http://localhost:3000` (local)
- Railway env → `FRONTEND_URL=https://your-app.vercel.app` (production)

---

## 10. Contributing

### Code style

**Frontend (TypeScript)**
- Follow existing component patterns — no class components, hooks only
- Co-locate `fetch` calls with the components that use them (no API client abstraction)
- Use Tailwind CSS utility classes; avoid inline `style` props
- Format with Prettier before committing

**Backend (Python)**
- Follow PEP 8 with a 120-character line limit (enforced by flake8)
- Keep each router file focused on one resource group
- Use Pydantic models for all request/response schemas
- Add the `X-User-Email` dependency to any endpoint that operates on user-owned data
- Encapsulate domain logic (state transitions, validation, aggregate boundary enforcement) in ORM model methods rather than in router handlers
- Raise domain exceptions (`InvalidStateTransitionError`, `BusinessRuleViolationError`, `AggregateNotFoundError`) for business rule violations — the global exception handler converts them to HTTP 400 responses

### Documentation update policy

- Update `docs/api.md` when adding or changing any endpoint
- Update `docs/database.md` when changing `models.py` or adding a migration
- Keep `README.md` in sync with any new setup steps or environment variables
- Write docs in English

### Test coverage requirements

- **Backend:** every new router endpoint should have at least one happy-path test and one error-path test in `backend/tests/`
- **Backend:** domain value objects and business logic should have unit tests in `backend/tests/domain/`
- **Backend:** domain model behavior (state transitions, validation, aggregate operations) should have unit tests in `backend/tests/domain/test_models.py`
- **Frontend:** add a test in `frontend/tests/` for any new component that contains non-trivial logic (conditional rendering, event handlers)
- Run the full test suite locally before opening a PR — CI will catch failures, but it's faster to fix them before pushing

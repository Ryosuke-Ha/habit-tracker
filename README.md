# Habit Tracker

A habit management web app based on the "implementation intentions" concept from Atomic Habits.

## Stack

- **Frontend**: Next.js 14 (TypeScript, App Router, Tailwind CSS) — port 3000
- **Backend**: FastAPI (Python 3.12, SQLite / PostgreSQL) — port 8000

---

## Setup & Running

### 1. Backend

```bash
cd backend

# Create virtual environment (first time only)
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
```

Edit `backend/.env`:

| Variable | Description | Default (dev) |
|----------|-------------|---------------|
| `DATABASE_URL` | DB connection URL. PostgreSQL (production) or SQLite path (development) | `sqlite:///./habit_tracker.db` |
| `FRONTEND_URL` | Frontend URL (CORS allowlist) | `http://localhost:3000` |

```bash
# Run database migrations
alembic upgrade head

# Start server
uvicorn main:app --reload
```

The SQLite database is created automatically on first run, along with seed data (weekday/weekend templates).

API docs: http://localhost:8000/docs

---

### 2. Frontend

```bash
cd frontend

# Copy and configure environment variables
cp .env.example .env.local
```

Edit `frontend/.env.local`:

| Variable | How to obtain |
|----------|--------------|
| `GOOGLE_CLIENT_ID` | Create an OAuth 2.0 client ID in [Google Cloud Console](https://console.cloud.google.com/) |
| `GOOGLE_CLIENT_SECRET` | Same as above |
| `NEXTAUTH_SECRET` | Generate with the command below |
| `NEXTAUTH_URL` | `http://localhost:3000` (dev) / your production URL |
| `NEXT_PUBLIC_BACKEND_URL` | FastAPI URL (dev: `http://localhost:8000`) |

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```
Paste the output as the value of `NEXTAUTH_SECRET`.

**Google OAuth configuration:**
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

```bash
# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Database Migrations (Alembic)

```bash
cd backend
source venv/bin/activate

# Apply all pending migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1

# Create a new migration after changing models.py
alembic revision --autogenerate -m "description"

# Show current migration state
alembic current
```

**Switching to PostgreSQL (Supabase):**
1. Create a project on [Supabase](https://supabase.com/)
2. Copy the **Transaction pooler** URI from Project Settings → Database → Connection string
3. Set `DATABASE_URL=<uri>` in `backend/.env`
4. Run `alembic upgrade head` to create all tables

---

## Features

- **Daily TODO list** — unified view of habit todos and carry-over todos, sorted by scheduled time
- **Habit templates** — separate templates for weekdays and weekends
- **Carry-over todos** — persistent todos that carry over across days
- **Subtasks** — accordion subtask list with progress bar for any todo
- **Weekly KPT review** — Keep / Problem / Try retrospective per week
- **Monthly review** — achievement stats with charts and next-month goal setting

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates` | List templates |
| GET | `/templates/{id}/habits` | List habits for a template |
| POST | `/habits` | Add a habit |
| PUT | `/habits/{id}` | Edit a habit |
| DELETE | `/habits/{id}` | Delete a habit |
| GET | `/logs/today?template_id={id}` | Today's check state |
| POST | `/logs/{habit_id}/toggle` | Toggle check |
| GET | `/persistent-todos` | List carry-over todos |
| POST | `/persistent-todos` | Create carry-over todo |
| PUT | `/persistent-todos/{id}` | Edit carry-over todo |
| POST | `/persistent-todos/{id}/complete` | Toggle completion |
| DELETE | `/persistent-todos/{id}` | Delete carry-over todo |
| GET | `/subtasks?todo_type=&todo_id=` | List subtasks |
| POST | `/subtasks` | Add subtask |
| POST | `/subtasks/{id}/toggle` | Toggle subtask |
| DELETE | `/subtasks/{id}` | Delete subtask |
| GET | `/reviews/weekly/current` | Get/create current week's review |
| POST | `/reviews/weekly/{id}/kpt` | Add KPT item |
| PUT | `/reviews/kpt/{id}` | Edit KPT item |
| DELETE | `/reviews/kpt/{id}` | Delete KPT item |
| GET | `/reviews/monthly/current` | Get/create current month's review |
| GET | `/reviews/monthly/{year_month}/stats` | Monthly achievement stats |
| PUT | `/reviews/monthly/{id}` | Update next-month goal |

---

## Directory Structure

```
habit-tracker/
├── frontend/
│   ├── app/
│   │   ├── page.tsx                  # Daily TODO screen
│   │   ├── templates/page.tsx        # Template management
│   │   ├── review/weekly/page.tsx    # Weekly KPT review
│   │   └── review/monthly/page.tsx  # Monthly review
│   └── components/
│       ├── TodoItem.tsx              # Unified todo card (habits + carry-over)
│       ├── HabitList.tsx             # Sorted unified todo list
│       ├── TemplateSelector.tsx      # Weekday/weekend selector
│       ├── LoadingOverlay.tsx        # Initial loading animation
│       └── HamburgerMenu.tsx         # Navigation menu
├── backend/
│   ├── main.py                       # FastAPI app + CORS + seed data
│   ├── models.py                     # SQLAlchemy models
│   ├── database.py                   # DB connection (env-var driven)
│   ├── requirements.txt
│   └── routers/
│       ├── templates.py
│       ├── habits.py
│       ├── reviews.py
│       ├── monthly_reviews.py
│       ├── persistent_todos.py
│       └── subtasks.py
└── README.md
```

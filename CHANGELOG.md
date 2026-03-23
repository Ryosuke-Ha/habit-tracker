# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Dedicated "+" button next to the subtask input field for adding subtasks (in addition to the existing Enter key method)
- Optimistic UI for subtask creation — subtask appears instantly and is reconciled after the server responds
- Optimistic UI for adding new habits/persistent TODOs via the modal — items appear instantly before server confirmation
- Double-submit prevention on the add-item modal and subtask add button

### Changed

- `GET /logs/today` and `POST /logs/standalone` now determine "today" using JST (UTC+9) instead of the server's local date
- `GET /persistent-todos` now returns only incomplete (`is_completed = false`) persistent todos instead of all todos for the user
- Subtask input area now uses a flex layout with the text input and add button side by side
- Subtask input placeholder simplified from "＋ サブタスクを追加 (Enter)" to "サブタスクを追加"
- Add subtask button is disabled when the input field is empty or a submission is in progress
- Add-item modal submit button is disabled while a submission is in progress

### Fixed

### Removed

---

## [1.0.0] - 2026-03-22

### Added

- Daily habit TODO management with a reusable template system
- Day-of-week based template configuration (separate templates for weekdays and weekends)
- Standalone one-off TODO entries that can be added to any day without creating a habit
- Persistent TODOs that carry over to every subsequent day until explicitly completed
- Subtask support for both daily habit logs and persistent TODOs
- Weekly review page with KPT (Keep, Problem, Try) format
- Automatic carry-over of last week's "Try" items into the current week's review
- Monthly review page with achievement rate graph (daily and weekly breakdown) and streak counter
- Monthly goal setting — goals set in one month are surfaced on the next month's daily screen
- Google OAuth authentication via NextAuth.js
- Cross-device settings sync — selected template preferences are stored in the database per user
- Hamburger menu with navigation to all app sections
- Loading overlay animation displayed on initial app launch
- Slack Auto-Fix Bot powered by Anthropic Claude API — accepts natural language instructions in Slack, opens a PR, waits for CI, and auto-merges

### Infrastructure

- Frontend deployed on Vercel with automatic preview deployments per pull request
- Backend (FastAPI + Python 3.11) deployed on Railway
- Database hosted on Supabase (PostgreSQL) with Alembic migrations
- GitHub Actions CI/CD pipeline: TypeScript type-check, Jest tests, and `next build` for the frontend; flake8 and pytest for the backend
- Slack Auto-Fix Bot deployed as a separate Railway service

[Unreleased]: https://github.com/Ryosuke-Ha/habit-tracker/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Ryosuke-Ha/habit-tracker/releases/tag/v1.0.0

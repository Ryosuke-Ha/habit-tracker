# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

### Changed

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

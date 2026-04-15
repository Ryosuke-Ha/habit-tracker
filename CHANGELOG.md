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
- HamburgerMenu navigation added to the weekly review, monthly review, and template management pages
- Double-submit prevention on all template CRUD operations (add, rename, delete) and habit CRUD operations (add, edit, delete) on the templates page
- Optimistic UI for habit deletion on the templates page with rollback on failure
- Saving indicator (`savingId`) for KPT item edits on the weekly review page
- Collapsible "completed items" accordion on the daily TODO dashboard — done items are grouped into a toggleable section instead of being shown inline
- Smart default time for new TODO items — time field now defaults to the next upcoming 30-minute interval instead of a fixed value
- Convert between daily log and persistent TODO — the edit form for daily log items and persistent TODOs now includes a "持ち越しTODO" toggle that converts the item between the two types (deletes the original and creates the new type with optimistic UI and rollback on failure)
- Full-screen loading spinner on the login page while the session status is loading

### Changed

- `GET /logs/today` and `POST /logs/standalone` now determine "today" using JST (UTC+9) instead of the server's local date
- `GET /persistent-todos` now returns only incomplete (`is_completed = false`) persistent todos instead of all todos for the user
- Subtask input area now uses a flex layout with the text input and add button side by side
- Subtask input placeholder simplified from "＋ サブタスクを追加 (Enter)" to "サブタスクを追加"
- Add subtask button is disabled when the input field is empty or a submission is in progress
- Add-item modal submit button is disabled while a submission is in progress
- Weekly review KPT items for Keep/Problem now display in a card-style layout with click-to-edit and inline editing (replacing the previous bullet-point list with separate edit/save buttons)
- Weekly review KPT Try items now display without bullet points ("・" prefix removed)
- Monthly review "Next month's goal" section is now always visible and editable regardless of whether the month is in the past or future (read-only restriction removed)
- Header layout on weekly review, monthly review, and templates pages changed to `justify-between` to accommodate the hamburger menu on the right
- Daily TODO list now separates incomplete and completed items — incomplete items are shown first, completed items are hidden behind a collapsible "完了済み" accordion that defaults to collapsed
- Past and future scheduled TODO sections on the memo page now group items by date, displaying a single date header per group instead of repeating the date for each item
- Editing a scheduled TODO on the memo page now defaults the time field to the next 30-minute interval when the todo has no saved time, instead of leaving it empty
- Memo page no longer displays past scheduled TODOs — only today's and future items are shown
- Memo page empty state message now checks today and future lists instead of the full todos array
- TodoItem edit form now shows a "持ち越しTODO" toggle for daily log (habit) and persistent TODO items, with amber-themed styling when the persistent toggle is active
- Login page sign-in button `disabled` state no longer depends on session loading status (handled by the new full-screen loading spinner instead)

### Fixed

- Fixed trailing slash in the previous week's review API call on the weekly review page
- Added error handling for failed previous week review fetch to prevent unhandled promise rejections
- Previous week's Try items state is now properly reset on week navigation to prevent stale data

### Removed

- Removed the "過去" (past) section from the memo page — past scheduled TODOs are no longer displayed

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

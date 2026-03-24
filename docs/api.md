# API Reference

## 1. Overview

### Base URLs

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:8000` |
| Production | *(configured via Railway — set in `NEXT_PUBLIC_BACKEND_URL`)* |

### Authentication

Most endpoints that operate on user-owned data require an `X-User-Email` header containing the authenticated user's email address. The email is obtained from the NextAuth.js session on the frontend and passed with every request.

Endpoints that do **not** require authentication are marked **No auth required** below. All others require:

```
X-User-Email: user@example.com
```

On first request, the backend automatically creates a user record if one does not already exist (upsert behavior).

### Response Format

All responses are JSON. Timestamps use ISO 8601 format (`YYYY-MM-DDTHH:MM:SS`). Dates use `YYYY-MM-DD`.

### Error Response Format

```json
{
  "detail": "Human-readable error message"
}
```

Common HTTP status codes:

| Code | Meaning |
|------|---------|
| `200` | Success |
| `204` | Success, no content |
| `400` | Bad request (validation error) |
| `401` | Missing `X-User-Email` header |
| `403` | Forbidden (e.g. deleting a protected resource) |
| `404` | Resource not found |

---

## 2. Authentication

### How to Obtain the User Email

The frontend uses NextAuth.js with Google OAuth 2.0. After sign-in, the user's email is available in the session:

```ts
import { useSession } from "next-auth/react";

const { data: session } = useSession();
const email = session?.user?.email; // "user@example.com"
```

### How to Include in Requests

Pass the email as the `X-User-Email` header on every authenticated request:

```ts
const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/persistent-todos`, {
  headers: {
    "X-User-Email": session.user.email,
  },
});
```

---

## 3. Endpoints

---

### Templates

#### `GET /templates`
> **No auth required**

Returns all habit templates.

**Response `200`**
```json
[
  { "id": 1, "name": "Weekday" },
  { "id": 2, "name": "Weekend" }
]
```

---

#### `POST /templates`
> **No auth required**

Creates a new habit template.

**Request Body**
```json
{ "name": "Morning Routine" }
```

**Response `200`**
```json
{ "id": 3, "name": "Morning Routine" }
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `400` | `"Name is required"` |
| `400` | `"Template name already exists"` |

---

#### `PUT /templates/{id}`
> **No auth required**

Updates a template's name.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Template ID |

**Request Body**
```json
{ "name": "Evening Routine" }
```

**Response `200`**
```json
{ "id": 3, "name": "Evening Routine" }
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `400` | `"Name is required"` |
| `404` | `"Template not found"` |

---

#### `DELETE /templates/{id}`
> **No auth required**

Deletes a template. The built-in templates `"平日"` (Weekday) and `"休日"` (Weekend) are protected and cannot be deleted.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Template ID |

**Response `200`**
```json
{ "ok": true }
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `403` | `"Template '平日' cannot be deleted"` |
| `404` | `"Template not found"` |

---

### Habits

#### `GET /templates/{id}/habits`
> **No auth required**

Returns all habits belonging to a template, ordered by `scheduled_time`.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Template ID |

**Response `200`**
```json
[
  {
    "id": 1,
    "template_id": 1,
    "title": "Morning Run",
    "scheduled_time": "07:00",
    "location": "Park",
    "order": 0
  },
  {
    "id": 2,
    "template_id": 1,
    "title": "Read",
    "scheduled_time": "22:00",
    "location": "Bedroom",
    "order": 1
  }
]
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Template not found"` |

---

#### `POST /habits`
> **No auth required**

Creates a new habit and appends it to the end of the template's habit list.

**Request Body**
```json
{
  "template_id": 1,
  "title": "Meditate",
  "scheduled_time": "08:00",
  "location": "Living Room"
}
```

**Response `200`**
```json
{
  "id": 3,
  "template_id": 1,
  "title": "Meditate",
  "scheduled_time": "08:00",
  "location": "Living Room",
  "order": 2
}
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Template not found"` |

---

#### `PUT /habits/{id}`
> **No auth required**

Updates a habit's title, time, or location.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Habit ID |

**Request Body**
```json
{
  "title": "Meditate 10 min",
  "scheduled_time": "08:30",
  "location": "Bedroom"
}
```

**Response `200`**
```json
{
  "id": 3,
  "template_id": 1,
  "title": "Meditate 10 min",
  "scheduled_time": "08:30",
  "location": "Bedroom",
  "order": 2
}
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Habit not found"` |

---

#### `DELETE /habits/{id}`
> **No auth required**

Deletes a habit. Existing daily logs for this habit are detached (their `habit_id` is set to `null`) and their title/time/location fields are copied over so historical data is preserved.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Habit ID |

**Response `200`**
```json
{ "ok": true }
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Habit not found"` |

---

### Logs

#### `GET /logs/today`
> **No auth required**

Returns today's daily log entries for a given template. Creates missing log entries on the fly (one per habit in the template). "Today" is determined using **JST (UTC+9)**.

**Query Parameters**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `template_id` | integer | Yes | Template to load today's logs for |

**Response `200`**
```json
[
  {
    "id": 101,
    "habit_id": 1,
    "title": "Morning Run",
    "scheduled_time": "07:00",
    "location": "Park",
    "is_checked": true,
    "order": 0
  },
  {
    "id": 102,
    "habit_id": null,
    "title": "One-off task",
    "scheduled_time": "10:00",
    "location": "",
    "is_checked": false,
    "order": 999
  }
]
```

> Standalone log entries (not linked to a habit) are included with `habit_id: null` and `order: 999`.

---

#### `POST /logs/{id}/toggle`
> **No auth required**

Toggles the `is_checked` state of a daily log entry.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Daily log ID |

**Response `200`**
```json
{
  "id": 101,
  "habit_id": 1,
  "title": "Morning Run",
  "scheduled_time": "07:00",
  "location": "Park",
  "is_checked": false,
  "order": 0
}
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Log not found"` |

---

#### `POST /logs/standalone`
> **No auth required**

Creates a one-off daily log entry for today that is not linked to any habit. "Today" is determined using **JST (UTC+9)**.

**Request Body**
```json
{
  "template_id": 1,
  "title": "Buy groceries",
  "scheduled_time": "12:00",
  "location": "Supermarket"
}
```

**Response `200`**
```json
{
  "id": 103,
  "habit_id": null,
  "title": "Buy groceries",
  "scheduled_time": "12:00",
  "location": "Supermarket",
  "is_checked": false,
  "order": 999
}
```

---

#### `PUT /logs/standalone/{id}`
> **No auth required**

Updates a standalone (non-habit) daily log entry.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Standalone log ID |

**Request Body**
```json
{
  "title": "Buy groceries and cook dinner",
  "scheduled_time": "13:00",
  "location": "Home"
}
```

**Response `200`**
```json
{
  "id": 103,
  "habit_id": null,
  "title": "Buy groceries and cook dinner",
  "scheduled_time": "13:00",
  "location": "Home",
  "is_checked": false,
  "order": 999
}
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Standalone log not found"` |

---

#### `DELETE /logs/{id}`
> **No auth required**

Deletes a daily log entry (standalone or habit-linked).

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Log ID |

**Response `200`**
```json
{ "ok": true }
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Log not found"` |

---

### Persistent Todos

All persistent todo endpoints require `X-User-Email`.

#### `GET /persistent-todos`

Returns all **incomplete** persistent todos for the authenticated user, ordered by creation time. Completed todos are excluded from the response.

**Response `200`**
```json
[
  {
    "id": 1,
    "user_id": "user@example.com",
    "title": "Finish project proposal",
    "scheduled_time": "10:00",
    "location": "Office",
    "is_completed": false,
    "completed_at": null,
    "created_at": "2026-03-01T09:00:00"
  }
]
```

---

#### `POST /persistent-todos`

Creates a new persistent todo.

**Request Body**
```json
{
  "title": "Finish project proposal",
  "scheduled_time": "10:00",
  "location": "Office"
}
```

**Response `200`**
```json
{
  "id": 1,
  "user_id": "user@example.com",
  "title": "Finish project proposal",
  "scheduled_time": "10:00",
  "location": "Office",
  "is_completed": false,
  "completed_at": null,
  "created_at": "2026-03-22T09:00:00"
}
```

---

#### `PUT /persistent-todos/{id}`

Updates a persistent todo's title, time, or location. All fields are optional.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Persistent todo ID |

**Request Body**
```json
{
  "title": "Finish and submit project proposal",
  "scheduled_time": "11:00",
  "location": "Library"
}
```

**Response `200`** — Updated `PersistentTodo` object.

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Not found"` |

---

#### `POST /persistent-todos/{id}/complete`

Toggles the `is_completed` state of a persistent todo. Sets `completed_at` to the current UTC time when marking as complete, or `null` when uncompleting.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Persistent todo ID |

**Response `200`**
```json
{
  "id": 1,
  "user_id": "user@example.com",
  "title": "Finish project proposal",
  "scheduled_time": "10:00",
  "location": "Office",
  "is_completed": true,
  "completed_at": "2026-03-22T14:30:00",
  "created_at": "2026-03-22T09:00:00"
}
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Not found"` |

---

#### `DELETE /persistent-todos/{id}`

Deletes a persistent todo.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Persistent todo ID |

**Response `204`** — No content.

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Not found"` |

---

### Subtasks

Subtask endpoints do **not** require `X-User-Email`. Access control is enforced implicitly via `todo_id`.

#### `GET /subtasks`

Returns all subtasks for a given parent item.

**Query Parameters**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `todo_type` | string | Yes | `"habit_log"` or `"persistent_todo"` |
| `todo_id` | integer | Yes | ID of the parent item |

**Response `200`**
```json
[
  {
    "id": 1,
    "todo_type": "habit_log",
    "todo_id": 101,
    "title": "Warm up 5 min",
    "is_completed": true,
    "order": 0,
    "created_at": "2026-03-22T07:00:00"
  },
  {
    "id": 2,
    "todo_type": "habit_log",
    "todo_id": 101,
    "title": "Run 5km",
    "is_completed": false,
    "order": 1,
    "created_at": "2026-03-22T07:01:00"
  }
]
```

---

#### `POST /subtasks`

Creates a new subtask appended to the end of the parent's subtask list.

**Request Body**
```json
{
  "todo_type": "habit_log",
  "todo_id": 101,
  "title": "Cool down 5 min"
}
```

**Response `200`**
```json
{
  "id": 3,
  "todo_type": "habit_log",
  "todo_id": 101,
  "title": "Cool down 5 min",
  "is_completed": false,
  "order": 2,
  "created_at": "2026-03-22T07:05:00"
}
```

---

#### `PUT /subtasks/{id}`

Updates a subtask's title.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Subtask ID |

**Request Body**
```json
{ "title": "Cool down and stretch 10 min" }
```

**Response `200`** — Updated `SubTask` object.

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Not found"` |

---

#### `POST /subtasks/{id}/toggle`

Toggles the `is_completed` state of a subtask.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Subtask ID |

**Response `200`** — Updated `SubTask` object.

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Not found"` |

---

#### `DELETE /subtasks/{id}`

Deletes a subtask.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Subtask ID |

**Response `204`** — No content.

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Not found"` |

---

### Weekly Reviews

All weekly review endpoints require `X-User-Email`.

#### `GET /reviews/weekly`

Returns all weekly reviews for the authenticated user, newest first.

**Response `200`**
```json
[
  {
    "id": 5,
    "user_id": "user@example.com",
    "week_start_date": "2026-03-15",
    "created_at": "2026-03-15T00:00:00",
    "updated_at": "2026-03-20T10:00:00",
    "kpt_items": [
      {
        "id": 12,
        "review_id": 5,
        "type": "keep",
        "content": "Morning run streak maintained",
        "is_completed": false,
        "created_at": "2026-03-15T08:00:00"
      }
    ]
  }
]
```

---

#### `GET /reviews/weekly/current`

Returns (or creates) the weekly review for the current week. The week starts on Sunday.

**Response `200`** — `WeeklyReview` object (see above).

---

#### `GET /reviews/weekly/{week_start_date}`

Returns (or creates) the weekly review for the week containing the given date.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `week_start_date` | string | Any date in `YYYY-MM-DD` format within the target week |

**Response `200`** — `WeeklyReview` object.

**Error Responses**
| Status | Detail |
|--------|--------|
| `400` | `"Invalid date format. Use YYYY-MM-DD"` |

---

#### `GET /reviews/weekly/current/try-items`

Returns the "Try" KPT items from **last week's** review. Useful for carrying over unfinished tries to the new week.

**Response `200`**
```json
[
  {
    "id": 9,
    "review_id": 4,
    "type": "try",
    "content": "Wake up at 6am every day",
    "is_completed": false,
    "created_at": "2026-03-10T08:00:00"
  }
]
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Last week's review not found"` |

---

#### `POST /reviews/weekly/{id}/kpt`

Adds a KPT item to a weekly review.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Weekly review ID |

**Request Body**
```json
{
  "type": "try",
  "content": "Go to bed before midnight"
}
```

> `type` must be one of `"keep"`, `"problem"`, or `"try"`.

**Response `200`**
```json
{
  "id": 13,
  "review_id": 5,
  "type": "try",
  "content": "Go to bed before midnight",
  "is_completed": false,
  "created_at": "2026-03-22T20:00:00"
}
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `400` | `"type must be keep, problem, or try"` |
| `404` | `"Review not found"` |

---

#### `PUT /reviews/kpt/{id}`

Updates a KPT item's content or completion state.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | KPT item ID |

**Request Body** *(all fields optional)*
```json
{
  "content": "Go to bed before 11pm",
  "is_completed": true
}
```

**Response `200`** — Updated `KPTItem` object.

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Item not found"` |

---

#### `DELETE /reviews/kpt/{id}`

Deletes a KPT item.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | KPT item ID |

**Response `204`** — No content.

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Item not found"` |

---

### Monthly Reviews

All monthly review endpoints require `X-User-Email`.

#### `GET /reviews/monthly`

Returns all monthly reviews for the authenticated user, newest first.

**Response `200`**
```json
[
  {
    "id": 3,
    "user_id": "user@example.com",
    "year_month": "2026-03",
    "next_month_goal": "Run a 5k under 30 minutes",
    "created_at": "2026-03-01T00:00:00",
    "updated_at": "2026-03-22T10:00:00"
  }
]
```

---

#### `GET /reviews/monthly/current`

Returns (or creates) the monthly review for the current month.

**Response `200`** — `MonthlyReview` object (see above).

---

#### `GET /reviews/monthly/current/goal`

Returns last month's `next_month_goal` as the current month's active goal (used on the daily TODO screen).

**Response `200`**
```json
{ "goal": "Run a 5k under 30 minutes" }
```

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"No goal set for this month"` — last month's review doesn't exist or has an empty goal |

---

#### `GET /reviews/monthly/{year_month}`

Returns (or creates) the monthly review for the given month.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `year_month` | string | Month in `YYYY-MM` format (e.g. `2026-03`) |

**Response `200`** — `MonthlyReview` object.

**Error Responses**
| Status | Detail |
|--------|--------|
| `400` | `"Invalid year_month format. Use YYYY-MM"` |

---

#### `GET /reviews/monthly/{year_month}/stats`

Returns achievement statistics for the given month.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `year_month` | string | Month in `YYYY-MM` format |

**Response `200`**
```json
{
  "overall_rate": 0.7833,
  "streak": 5,
  "daily_rates": [
    { "date": "2026-03-01", "rate": 1.0, "checked": 3, "total": 3 },
    { "date": "2026-03-02", "rate": 0.6667, "checked": 2, "total": 3 }
  ],
  "weekly_rates": [
    { "week_start": "2026-03-01", "rate": 0.8571 },
    { "week_start": "2026-03-08", "rate": 0.75 }
  ]
}
```

| Field | Description |
|-------|-----------|
| `overall_rate` | Ratio of checked logs to total logs for the month (0–1) |
| `streak` | Consecutive days ending today with at least one check |
| `daily_rates` | Per-day breakdown, only up to today |
| `weekly_rates` | Per-week (Sun–Sat) aggregated rates |

**Error Responses**
| Status | Detail |
|--------|--------|
| `400` | `"Invalid year_month format. Use YYYY-MM"` |

---

#### `PUT /reviews/monthly/{id}`

Updates the `next_month_goal` for a monthly review.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Monthly review ID |

**Request Body**
```json
{ "next_month_goal": "Meditate every day without missing" }
```

**Response `200`** — Updated `MonthlyReview` object.

**Error Responses**
| Status | Detail |
|--------|--------|
| `404` | `"Review not found"` |

---

### Settings

All settings endpoints require `X-User-Email`.

#### `GET /settings`

Returns all settings for the authenticated user as a key-value map.

**Response `200`**
```json
{
  "weekday_template_id": "1",
  "weekend_template_id": "2"
}
```

---

#### `PUT /settings/{key}`

Creates or updates a single setting value.

**Path Parameters**
| Name | Type | Description |
|------|------|-------------|
| `key` | string | Setting key (e.g. `weekday_template_id`) |

**Request Body**
```json
{ "value": "3" }
```

**Response `200`**
```json
{ "key": "weekday_template_id", "value": "3" }
```

---

### Health

#### `GET /health`
> **No auth required**

Returns the API health status.

**Response `200`**
```json
{ "status": "ok" }
```

---

## 4. Data Models

```ts
interface Template {
  id: number;
  name: string;
}

interface Habit {
  id: number;
  template_id: number;
  title: string;
  scheduled_time: string; // "HH:MM"
  location: string;
  order: number;
}

interface DailyLog {
  id: number;
  habit_id: number | null;  // null for standalone logs
  title: string;
  scheduled_time: string;   // "HH:MM"
  location: string;
  is_checked: boolean;
  order: number;            // 999 for standalone logs
}

interface PersistentTodo {
  id: number;
  user_id: string;          // user email
  title: string;
  scheduled_time: string | null;
  location: string | null;
  is_completed: boolean;
  completed_at: string | null; // ISO 8601 datetime
  created_at: string;          // ISO 8601 datetime
}

interface SubTask {
  id: number;
  todo_type: "habit_log" | "persistent_todo";
  todo_id: number;
  title: string;
  is_completed: boolean;
  order: number;
  created_at: string; // ISO 8601 datetime
}

interface KPTItem {
  id: number;
  review_id: number;
  type: "keep" | "problem" | "try";
  content: string;
  is_completed: boolean;
  created_at: string; // ISO 8601 datetime
}

interface WeeklyReview {
  id: number;
  user_id: string;
  week_start_date: string; // "YYYY-MM-DD", always a Sunday
  created_at: string;      // ISO 8601 datetime
  updated_at: string;      // ISO 8601 datetime
  kpt_items: KPTItem[];
}

interface MonthlyReview {
  id: number;
  user_id: string;
  year_month: string;         // "YYYY-MM"
  next_month_goal: string | null;
  created_at: string;         // ISO 8601 datetime
  updated_at: string;         // ISO 8601 datetime
}

interface UserSettings {
  [key: string]: string; // key-value map, all values are strings
}

interface MonthlyStats {
  overall_rate: number;  // 0.0 – 1.0
  streak: number;
  daily_rates: Array<{
    date: string;    // "YYYY-MM-DD"
    rate: number;    // 0.0 – 1.0
    checked: number;
    total: number;
  }>;
  weekly_rates: Array<{
    week_start: string; // "YYYY-MM-DD"
    rate: number;       // 0.0 – 1.0
  }>;
}
```

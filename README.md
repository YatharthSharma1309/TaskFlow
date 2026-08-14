# TaskFlow

TaskFlow is a lightweight board for shipping a launch — one board, three columns, tasks that persist in SQLite.

**Repository:** [github.com/YatharthSharma1309/TaskFlow](https://github.com/YatharthSharma1309/TaskFlow)

```
User ──< Board ──< Column ──< Task
```

A task's status is where it sits on the board: **Ready**, **In Progress**, or **Done**. Each account has its own board.

**Demo login:** `demo@taskflow.app` / `demo1234`

## Run locally

You need **Python 3.11+** and **Node.js 18+**.

### 1. Backend

From the repo root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r server\requirements.txt
cd server
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 3001
```

macOS / Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
cd server
uvicorn main:app --reload --port 3001
```

The first start creates `server/data/taskflow.db` (SQLite) and seeds a demo account (`demo@taskflow.app` / `demo1234`) with a sample board. That is the assignment default. If `DATABASE_URL` is set, the same app talks to Postgres instead.

### 2. Frontend

In a second terminal, from the repo root:

```bash
npm install --prefix client
npm run dev --prefix client
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to the backend on port 3001.

Creates, edits, moves, and deletes save immediately. Reload the page to confirm the data is not just React state.

Reset demo data (from the `server` folder):

```powershell
..\.venv\Scripts\python.exe reset_seed.py
```

```bash
../.venv/bin/python reset_seed.py
```

### Tests

From the `server` folder:

```powershell
..\.venv\Scripts\python.exe -m pytest
```

```bash
../.venv/bin/python -m pytest
```

Covers: empty title rejected, moving a task changes its column, the two SQL queries against known seed rows, sign-in, and one user not seeing another user's board.

### One-command (Docker)

```bash
docker compose up --build
```

Then open [http://localhost:3001](http://localhost:3001).

## What it does

- Sign in / create an account (httpOnly session cookie)
- View your board with columns and tasks
- Create / edit / delete a task
- Move a task by **drag-and-drop**, or change **status** in the edit dialog
- Filter by priority (SQL, not a client-side filter of a full dump)
- Search by title (nice-to-have from §2.3; also SQL)
- Column headers show task counts from the required `COUNT` + `GROUP BY` query

Title is required on the form, in the API, and with a `CHECK` on `tasks.title`. Failed requests show a banner (or an in-dialog message) with Retry / Dismiss — not a blank screen.

## Schema

See [`server/schema.sql`](server/schema.sql). Short version:

| Table | Keys / constraints |
| --- | --- |
| `users` | `id` PK, `email` unique, `password_hash` |
| `sessions` | `token` PK, `user_id` → `users(id)` |
| `boards` | `id` PK, `user_id` → `users(id)` (one board per account), `name` NOT NULL |
| `columns` | `id` PK, `board_id` → `boards(id)`, `name` NOT NULL |
| `tasks` | `id` PK, `column_id` → `columns(id)`, `title` NOT NULL + non-empty CHECK, `priority` IN (`Low`,`Medium`,`High`), `created_at` NOT NULL |

## The two non-trivial queries

These live in [`server/queries.py`](server/queries.py) and are used by the API (not computed in Python after `SELECT *`).

**1. Task count per column on a board**

```sql
SELECT
  c.id,
  c.name,
  c.position,
  COUNT(t.id) AS task_count
FROM columns c
LEFT JOIN tasks t ON t.column_id = c.id
WHERE c.board_id = ?
GROUP BY c.id, c.name, c.position
ORDER BY c.position ASC;
```

Exposed as `GET /api/boards/:id/task-counts` and included on the board payload.

**2. Tasks with a given priority, newest first**

```sql
SELECT
  t.id, t.column_id, t.title, t.description,
  t.priority, t.position, t.created_at,
  c.name AS column_name
FROM tasks t
INNER JOIN columns c ON c.id = t.column_id
WHERE c.board_id = ?
  AND t.priority = ?
ORDER BY t.created_at DESC, t.id DESC;
```

Exposed as `GET /api/boards/:id/tasks?priority=High`.

Board load with filters (`?priority=` and `?q=`) uses the same idea: `WHERE` clauses in SQL.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/register` | `{ email, password }` — creates an empty board |
| `POST` | `/api/auth/login` | `{ email, password }` — httpOnly cookie |
| `POST` | `/api/auth/logout` | Clears the session |
| `GET` | `/api/auth/me` | Current user + `board_id` |
| `GET` | `/api/boards/:id` | Own board only. Optional `priority`, `q` |
| `GET` | `/api/boards/:id/task-counts` | Query 1 |
| `GET` | `/api/boards/:id/tasks?priority=` | Query 2 |
| `POST` | `/api/tasks` | `{ columnId, title, description?, priority? }` |
| `PATCH` | `/api/tasks/:id` | `{ title?, description?, priority?, columnId? }` |
| `PATCH` | `/api/tasks/:id/move` | `{ columnId }` |
| `DELETE` | `/api/tasks/:id` | |

## Layout

```
client/                 React + Vite (TypeScript)
server/
  schema.sql            SQLite schema (local / tests / assignment default)
  schema.postgres.sql   Postgres schema (only if DATABASE_URL is set)
  queries.py            all SQL
  routers/              HTTP handlers
  tests/                pytest
```

## Decisions & assumptions

- **One board per account.** There is no board CRUD or switcher — register creates Ready / In Progress / Done, and the demo account is pre-seeded with launch tasks.
- **Status is the column.** There is no separate status field — `column_id` is the source of truth, and the column name is what you see in the UI.
- **Priority defaults to Medium** when omitted on create.
- **Python + handwritten SQL**, no ORM. The assignment path is stdlib `sqlite3` (`server/schema.sql`). The same queries in `queries.py` also run on Postgres when `DATABASE_URL` is set; only placeholders and `RETURNING id` change.
- **Passwords** are `pbkdf2_hmac` in the standard library; sessions are random tokens in the database, sent as an httpOnly cookie (`Secure` over HTTPS). No JWT package.
- **Stretch goal:** drag-and-drop. Title search is the §2.3 nice-to-have. Column counts are the required SQL query shown in the UI, not a separate feature I spent leftover time on. The column dropdown in the edit dialog is the fallback if drag fails.
- No realtime, no file uploads, no password reset.

## Hosted demo

A hosted copy is at [https://taskflow-production-46f1.up.railway.app](https://taskflow-production-46f1.up.railway.app) (`GET /api/health`, demo login above). Review the GitHub repo for the current code; run it locally or with Docker to match this README.

Local Docker:

```bash
docker compose up --build
```

Then open [http://localhost:3001](http://localhost:3001). Compose mounts a volume for SQLite if `DATABASE_URL` is unset. `render.yaml` is also in the repo if you prefer Render.

## If I had more time

- Persist order *within* a column after a drop, not just which column the task landed in
- Multiple boards and a board switcher
- A couple of frontend tests around the error banner and the empty-title path

## Time spent

About 5 hours, including schema, tests, UI pass, and writing this up.

## One thing I looked up

SQLite keeps foreign keys **off** unless you `PRAGMA foreign_keys = ON` on every connection. Easy to miss if you only put it in `schema.sql` and then open the file again later. I set it in `create_database` so every connection actually enforces `Task → Column → Board`.

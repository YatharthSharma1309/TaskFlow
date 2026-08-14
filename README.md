# TaskFlow

A small launch board: one account, one board, three columns, tasks that persist in SQLite.

**Repository:** [github.com/YatharthSharma1309/TaskFlow](https://github.com/YatharthSharma1309/TaskFlow)

```
User ──< Board ──< Column ──< Task
```

A task’s **status is the column it sits in** — Ready, In Progress, or Done. There is no separate status field.

**Demo login:** `demo@taskflow.app` / `demo1234`

This README is how to run and review the project. Clone the repo and run it locally (or with Docker). A hosted copy at [taskflow-production-46f1.up.railway.app](https://taskflow-production-46f1.up.railway.app) may lag this tree.

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript + Vite |
| API | FastAPI |
| Data | Handwritten SQL, no ORM |
| Default database | stdlib `sqlite3` → `server/data/taskflow.db` |
| Optional database | Postgres when `DATABASE_URL` is set |
| Auth | PBKDF2 password hash + httpOnly session cookie (`tf_session`, 7 days) |

## Run locally

You need **Python 3.11+** and **Node.js 18+**. Two terminals, from the repo root.

### 1. API

Windows:

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

The first start creates `server/data/taskflow.db`, then seeds the demo account and a sample launch board. That is the assignment default.

### 2. UI

```bash
npm install --prefix client
npm run dev --prefix client
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to `http://127.0.0.1:3001`.

Creates, edits, moves, and deletes save through the API. Reload the page to confirm the data is not just React state.

Health check: `GET http://127.0.0.1:3001/api/health` → `{ "ok": true }`.

### Reset demo data

From the `server` folder:

```powershell
..\.venv\Scripts\python.exe reset_seed.py
```

```bash
../.venv/bin/python reset_seed.py
```

### Tests

From the `server` folder (uses an in-memory SQLite database):

```powershell
..\.venv\Scripts\python.exe -m pytest
```

```bash
../.venv/bin/python -m pytest
```

23 cases. They cover empty titles, moving a task, the two required SQL queries against known seed rows, title search, combined filters, sign-in, register, logout, duplicate email, and one user not seeing another user’s board.

### Docker (API + built UI on one port)

```bash
docker compose up --build
```

Then open [http://localhost:3001](http://localhost:3001). Compose keeps SQLite on a volume when `DATABASE_URL` is unset.

## Using the board

- **Sign in** with the demo account, or **create an account** (password at least 8 characters). A new account gets an empty Ready / In Progress / Done board.
- **New task** in the header, or press **C** when a text field is not focused. Column **+ Add task** uses that column.
- **Click a card** to edit. Drag a card to another column, or change **Status** in the dialog.
- **Priority** pills and the search box filter in SQL (`?priority=` and `?q=`), not by downloading every task and hiding some in the client.
- Closing the dialog with unsaved edits asks **Discard** in the dialog (not a browser `confirm`). Title errors sit under Title. **New task** is disabled while a dialog is open.
- Column headers show counts from the required `COUNT` + `GROUP BY` query (visible / total when a filter is on).

Out of scope, on purpose: assignees, comments, due dates, realtime, uploads, OAuth, password reset, multiple boards.

## Schema

See [`server/schema.sql`](server/schema.sql). Postgres equivalent: [`server/schema.postgres.sql`](server/schema.postgres.sql).

| Table | Keys / constraints |
| --- | --- |
| `users` | `id` PK, `email` unique (case-insensitive), `password_hash` |
| `sessions` | `token` PK, `user_id` → `users(id)` |
| `boards` | `id` PK, `user_id` → `users(id)` unique (one board per account) |
| `columns` | `id` PK, `board_id` → `boards(id)`, `name`, `position` |
| `tasks` | `id` PK, `column_id` → `columns(id)`, `title` NOT NULL + non-empty `CHECK`, `priority` IN (`Low`, `Medium`, `High`), `created_at` |

Title is required on the form, in the API (`server/validation.py`), and in the database `CHECK`. Max title 200 characters, description 2000.

## The two non-trivial queries

These live in [`server/queries.py`](server/queries.py) and are used by the API. They are not `SELECT *` followed by counting or filtering in Python.

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

`LEFT JOIN` so empty columns still return `0`. Exposed as `GET /api/boards/:id/task-counts` and included on the board payload.

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

Board load (`GET /api/boards/:id?priority=&q=`) uses the same idea: `WHERE` clauses in SQL.

## API

Board and task routes require a valid `tf_session` cookie and only operate on the signed-in user’s board.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | `{ "ok": true }` |
| `POST` | `/api/auth/register` | `{ email, password }` — empty Ready / In Progress / Done board, sets cookie |
| `POST` | `/api/auth/login` | `{ email, password }` — httpOnly cookie |
| `POST` | `/api/auth/logout` | Clears the session |
| `GET` | `/api/auth/me` | Current user + `board_id` |
| `GET` | `/api/boards/:id` | Own board only. Optional `priority`, `q` |
| `GET` | `/api/boards/:id/task-counts` | Query 1 |
| `GET` | `/api/boards/:id/tasks?priority=` | Query 2 |
| `POST` | `/api/tasks` | `{ columnId, title, description?, priority? }` |
| `PATCH` | `/api/tasks/:id` | `{ title?, description?, priority?, columnId? }` — title + column in one request |
| `PATCH` | `/api/tasks/:id/move` | `{ columnId }` |
| `DELETE` | `/api/tasks/:id` | |

Errors are JSON `{ "error": "..." }` with a 4xx/5xx status. The UI shows that message in a banner or in the task dialog.

## Layout

```
client/                 React + Vite (TypeScript)
  src/App.tsx           Session, board load, drag-and-drop, filters
  src/components/       Auth, header, columns, cards, task dialog
server/
  main.py               Connects the database and builds the app
  app.py                FastAPI app, health, static UI in Docker
  schema.sql            SQLite schema (assignment default)
  schema.postgres.sql   Postgres schema (only if DATABASE_URL is set)
  queries.py            All SQL, including the two required queries
  routers/              Auth, boards, tasks
  validation.py         Title / priority / id rules
  seed.py               Demo account + sample launch tasks
  tests/                pytest (SQLite in memory)
```

## Configuration

None required for the assignment path. Optional values are listed in [`.env.example`](.env.example). Copy to `.env` at the repo root if you need them. `.env` is gitignored.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | unset (SQLite) | Postgres URL. Same `queries.py`; placeholders become `%s` and inserts use `RETURNING id`. Idle disconnects are retried once. |
| `TASKFLOW_SECURE_COOKIES` | unset (off) | Set to `1` when serving over HTTPS so the session cookie is `Secure`. |
| `TASKFLOW_DB_PATH` | `server/data/taskflow.db` | SQLite file path when `DATABASE_URL` is unset. |

## Decisions

- **One board per account.** Register creates Ready / In Progress / Done. The demo account is pre-seeded with launch tasks. There is no board switcher.
- **Status is `column_id`.** The column name is what you see in the UI.
- **Priority defaults to Medium** when omitted on create.
- **SQL in the API, not in the client.** Filters, search, and column counts hit the database.
- **Python + handwritten SQL**, no ORM. SQLite is the take-home default. Postgres is optional.
- **Passwords** are `pbkdf2_hmac` in the standard library. Sessions are random tokens in `sessions`, not JWTs.
- **Stretch:** drag-and-drop. Title search is the nice-to-have. Column counts are the required query shown in the UI. The status dropdown is the fallback if drag fails.
- **Edit + column change is one PATCH** so the two fields cannot land in different states.

## If I had more time

- Persist order *within* a column after a drop, not only which column the task landed in
- A couple of frontend tests around the error banner and the empty-title path

## Time spent

A take-home pass: schema, API, tests, and UI, then a second pass on dialog/filter/auth quality.

## One thing I looked up

SQLite keeps foreign keys **off** unless you `PRAGMA foreign_keys = ON` on every connection. Easy to miss if you only put it in `schema.sql` and then open the file again later. It is set in `create_database` so every connection actually enforces `Task → Column → Board → User`.

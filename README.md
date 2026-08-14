# TaskFlow

A small Kanban board: one board, three columns, tasks that persist in SQLite.

**Live demo:** [https://taskflow-production-46f1.up.railway.app](https://taskflow-production-46f1.up.railway.app)

**Repository:** [github.com/YatharthSharma1309/TaskFlow](https://github.com/YatharthSharma1309/TaskFlow)

```
Board ──< Column ──< Task
```

A task's **status** is the column it currently lives in (`To Do` / `In Progress` / `Done`).

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

The first start creates `server/data/taskflow.db` and seeds a **Product Launch** board.

### 2. Frontend

In a second terminal, from the repo root:

```bash
npm install --prefix client
npm run dev --prefix client
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to the backend on port 3001.

Creates, edits, moves, and deletes save to SQLite immediately. Reload the page to confirm the data is not just React state.

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

Covers: empty title rejected, moving a task changes its column, and the two SQL queries against known seed rows.

### One-command (Docker)

```bash
docker compose up --build
```

Then open [http://localhost:3001](http://localhost:3001).

## What it does

- View a board with columns and tasks
- Create / edit / delete a task
- Move a task by **drag-and-drop**, or with the **column dropdown** in the edit dialog
- Filter by priority (SQL, not a client-side filter of a full dump)
- Search by title (nice-to-have from §2.3; also SQL)
- Column headers show task counts from the required `COUNT` + `GROUP BY` query

Title is required on the form, in the API, and with a `CHECK` on `tasks.title`. Failed requests show a banner (or an in-dialog message) with Retry / Dismiss — not a blank screen.

## Schema

See [`server/schema.sql`](server/schema.sql). Short version:

| Table | Keys / constraints |
| --- | --- |
| `boards` | `id` PK, `name` NOT NULL |
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
| `GET` | `/api/boards/:id` | Optional `priority`, `q` |
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
  schema.sql            source of truth for the database
  queries.py            all SQL
  routers/              HTTP handlers
  tests/                pytest
```

## Decisions & assumptions

- **One board** is enough for the assignment, so there is no board CRUD. A fresh database always gets the seeded Product Launch board.
- **Status = column.** I did not store a separate `status` string; `column_id` is the source of truth and the column name is what you see.
- **Priority defaults to Medium** when omitted on create.
- **Python + stdlib `sqlite3`**, with the SQL written by hand rather than an ORM, so the required queries are obvious in `queries.py`. I picked Python over Node for the API because SQLite is in the standard library — a fresh clone does not need a native addon or a C++ toolchain, which is the difference between "works on my machine" and "works after `pip install`".
- **Stretch goal:** drag-and-drop. Title search is the §2.3 nice-to-have. Column counts are the required SQL query shown in the UI, not a separate feature I spent leftover time on. The column dropdown in the edit dialog is the fallback if drag fails.
- No auth, no realtime, no multi-user — as specified.

## Live demo

Open [https://taskflow-production-46f1.up.railway.app](https://taskflow-production-46f1.up.railway.app). Health: `GET /api/health`. SQLite on this free host is ephemeral — the board re-seeds when the instance restarts.

Local Docker:

```bash
docker compose up --build
```

Then open [http://localhost:3001](http://localhost:3001). `render.yaml` is also in the repo if you prefer Render.

## If I had more time

- Persist order *within* a column after a drop, not just which column the task landed in
- Multiple boards and a board switcher
- A couple of frontend tests around the error banner and the empty-title path
- A persistent disk so the Railway SQLite file survives restarts

## Time spent

About 5 hours, including schema, tests, UI pass, and writing this up.

## One thing I looked up

SQLite keeps foreign keys **off** unless you `PRAGMA foreign_keys = ON` on every connection. Easy to miss if you only put it in `schema.sql` and then open the file again later. I set it in `create_database` so every connection actually enforces `Task → Column → Board`.

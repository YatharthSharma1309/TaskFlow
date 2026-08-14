from fastapi.testclient import TestClient

from app import create_app
from db import create_database
from queries import count_tasks_per_column, get_task, list_tasks_by_priority
from seed import DEMO_EMAIL, DEMO_PASSWORD


def setup():
    conn = create_database(":memory:")
    client = TestClient(create_app(conn), raise_server_exceptions=False)
    signed = client.post(
        "/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    assert signed.status_code == 200
    return conn, client


def setup_anon():
    conn = create_database(":memory:")
    client = TestClient(create_app(conn), raise_server_exceptions=False)
    return conn, client


def test_creating_a_task_with_no_title_fails():
    _conn, client = setup()

    missing = client.post("/api/tasks", json={"columnId": 1, "priority": "Low"})
    assert missing.status_code == 400
    assert "title" in missing.json()["error"].lower()

    empty = client.post("/api/tasks", json={"columnId": 1, "title": "   ", "priority": "High"})
    assert empty.status_code == 400
    assert "title" in empty.json()["error"].lower()


def test_moving_a_task_updates_its_column():
    conn, client = setup()

    created = client.post(
        "/api/tasks",
        json={"columnId": 1, "title": "Move me", "priority": "Medium"},
    )
    assert created.status_code == 201
    task_id = created.json()["id"]
    assert created.json()["column_id"] == 1
    assert created.json()["column_name"] == "Ready"

    moved = client.patch(f"/api/tasks/{task_id}/move", json={"columnId": 2})
    assert moved.status_code == 200
    assert moved.json()["column_id"] == 2
    assert moved.json()["column_name"] == "In Progress"

    from_db = get_task(conn, task_id)
    assert from_db["column_id"] == 2
    assert from_db["column_name"] == "In Progress"


def test_count_tasks_per_column_returns_seed_counts():
    conn, _client = setup()
    rows = count_tasks_per_column(conn, 1)
    assert [(row["name"], row["task_count"]) for row in rows] == [
        ("Ready", 3),
        ("In Progress", 2),
        ("Done", 2),
    ]


def test_list_tasks_by_priority_returns_high_tasks_newest_first():
    conn, _client = setup()
    rows = list_tasks_by_priority(conn, 1, "High")
    assert [row["title"] for row in rows] == [
        "Implement checkout flow",
        "Write launch blog post",
    ]
    assert rows[0]["created_at"] > rows[1]["created_at"]
    assert rows[0]["column_name"] == "In Progress"
    assert rows[1]["column_name"] == "Ready"


def test_task_counts_endpoint_uses_sql_count_query():
    _conn, client = setup()
    res = client.get("/api/boards/1/task-counts")
    assert res.status_code == 200
    body = res.json()
    assert body[0]["task_count"] == 3
    assert body[1]["task_count"] == 2
    assert body[2]["task_count"] == 2


def test_tasks_by_priority_endpoint():
    _conn, client = setup()
    res = client.get("/api/boards/1/tasks", params={"priority": "High"})
    assert res.status_code == 200
    assert res.json()[0]["title"] == "Implement checkout flow"


def test_board_title_search_filters_in_sql():
    _conn, client = setup()
    res = client.get("/api/boards/1", params={"q": "checkout"})
    assert res.status_code == 200
    titles = [task["title"] for col in res.json()["columns"] for task in col["tasks"]]
    assert titles == ["Implement checkout flow"]


def test_patch_updates_title_and_column_in_one_request():
    conn, client = setup()

    created = client.post(
        "/api/tasks",
        json={"columnId": 1, "title": "Atomic me", "priority": "Low"},
    )
    assert created.status_code == 201
    task_id = created.json()["id"]

    updated = client.patch(
        f"/api/tasks/{task_id}",
        json={"title": "Moved and renamed", "columnId": 3},
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["title"] == "Moved and renamed"
    assert body["column_id"] == 3
    assert body["column_name"] == "Done"

    from_db = get_task(conn, task_id)
    assert from_db["title"] == "Moved and renamed"
    assert from_db["column_id"] == 3
    assert from_db["column_name"] == "Done"


def test_updating_a_task_with_empty_title_fails():
    _conn, client = setup()
    res = client.patch("/api/tasks/1", json={"title": ""})
    assert res.status_code == 400
    assert "title" in res.json()["error"].lower()


def test_patch_same_column_keeps_position():
    conn, client = setup()
    before = get_task(conn, 1)
    res = client.patch(
        "/api/tasks/1",
        json={"title": "Renamed in place", "columnId": before["column_id"]},
    )
    assert res.status_code == 200
    after = get_task(conn, 1)
    assert after["title"] == "Renamed in place"
    assert after["column_id"] == before["column_id"]
    assert after["position"] == before["position"]


def test_move_to_same_column_is_noop():
    conn, client = setup()
    before = get_task(conn, 1)
    res = client.patch("/api/tasks/1/move", json={"columnId": before["column_id"]})
    assert res.status_code == 200
    after = get_task(conn, 1)
    assert after["position"] == before["position"]
    assert after["column_id"] == before["column_id"]


def test_unknown_api_get_returns_json_404():
    _conn, client = setup()
    res = client.get("/api/does-not-exist")
    assert res.status_code == 404
    assert "error" in res.json()


def test_deleting_a_task_removes_it():
    conn, client = setup()
    res = client.delete("/api/tasks/1")
    assert res.status_code == 204
    assert get_task(conn, 1) is None


def test_board_requires_sign_in():
    _conn, client = setup_anon()
    res = client.get("/api/boards/1")
    assert res.status_code == 401
    assert "sign in" in res.json()["error"].lower()


def test_login_rejects_wrong_password():
    _conn, client = setup_anon()
    res = client.post(
        "/api/auth/login",
        json={"email": DEMO_EMAIL, "password": "not-the-password"},
    )
    assert res.status_code == 401


def test_register_creates_empty_private_board():
    _conn, client = setup_anon()
    res = client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "password1"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "new@example.com"
    board = client.get(f"/api/boards/{body['board_id']}")
    assert board.status_code == 200
    columns = board.json()["columns"]
    assert [column["name"] for column in columns] == ["Ready", "In Progress", "Done"]
    assert all(column["task_count"] == 0 for column in columns)


def test_users_cannot_see_each_others_boards():
    conn, demo = setup()
    demo_board = demo.get("/api/auth/me").json()["board_id"]

    other = TestClient(create_app(conn), raise_server_exceptions=False)
    created = other.post(
        "/api/auth/register",
        json={"email": "other@example.com", "password": "password1"},
    )
    assert created.status_code == 201
    other_board = created.json()["board_id"]
    assert other_board != demo_board

    assert other.get(f"/api/boards/{demo_board}").status_code == 404
    assert demo.get(f"/api/boards/{other_board}").status_code == 404
    assert other.delete("/api/tasks/1").status_code == 404


def test_duplicate_email_is_rejected():
    _conn, client = setup_anon()
    res = client.post(
        "/api/auth/register",
        json={"email": DEMO_EMAIL, "password": "password1"},
    )
    assert res.status_code == 400


def test_board_unknown_id_is_404():
    _conn, client = setup()
    res = client.get("/api/boards/999")
    assert res.status_code == 404


def test_board_combined_priority_and_title_filter():
    _conn, client = setup()
    res = client.get("/api/boards/1", params={"priority": "High", "q": "checkout"})
    assert res.status_code == 200
    titles = [task["title"] for col in res.json()["columns"] for task in col["tasks"]]
    assert titles == ["Implement checkout flow"]


def test_invalid_priority_filter_is_400():
    _conn, client = setup()
    res = client.get("/api/boards/1", params={"priority": "Urgent"})
    assert res.status_code == 400


def test_me_returns_demo_user_when_signed_in():
    _conn, client = setup()
    res = client.get("/api/auth/me")
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == DEMO_EMAIL
    assert body["board_id"] == 1


def test_logout_clears_the_session():
    _conn, client = setup()
    assert client.get("/api/auth/me").status_code == 200
    out = client.post("/api/auth/logout")
    assert out.status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/boards/1").status_code == 401


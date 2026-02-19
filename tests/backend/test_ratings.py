import pytest
from fastapi.testclient import TestClient

from backend.main import app


class FakeCursor:
    def __init__(self, steps):
        self.steps = list(steps)
        self.current_step = None

    def execute(self, query, params=None):
        assert self.steps, f"Unexpected query executed: {query}"
        step = self.steps.pop(0)
        matcher = step.get("match")
        if callable(matcher):
            assert matcher(query), f"Query matcher failed for: {query}"
        elif matcher:
            assert matcher.lower() in query.lower(), f"Expected '{matcher}' in query: {query}"
        self.current_step = step

    def fetchone(self):
        if not self.current_step:
            return None
        value = self.current_step.get("fetchone")
        return value

    def fetchall(self):
        if not self.current_step:
            return []
        return self.current_step.get("fetchall", [])

    def close(self):
        pass


class FakeConnection:
    def __init__(self, steps):
        self.cursor_obj = FakeCursor(steps)
        self.committed = False
        self.closed = False

    def cursor(self, cursor_factory=None):
        return self.cursor_obj

    def commit(self):
        self.committed = True

    def close(self):
        self.closed = True


client = TestClient(app)


def test_submit_rating_updates_average(monkeypatch):
    steps = [
        {
            "match": "SELECT rating_id",
            "fetchone": {
                "rating_id": 10,
                "rater_id": 1,
                "ratee_id": 42,
                "status": "pending",
            },
        },
        {
            "match": "UPDATE user_ratings",
            "fetchone": {
                "rating_id": 10,
                "ratee_id": 42,
                "score": 4.5,
                "status": "completed",
            },
        },
        {
            "match": "SELECT AVG",
            "fetchone": (4.5,),
        },
        {
            "match": "UPDATE users",
        },
    ]
    fake_conn = FakeConnection(steps)
    monkeypatch.setattr("backend.main.get_db_connection", lambda: fake_conn)

    response = client.post(
        "/api/ratings/10/submit",
        json={"score": 4.5, "feedback": "Great partner", "rater_id": 1},
    )
    assert response.status_code == 200
    payload = response.json()["rating"]
    assert payload["score"] == 4.5
    assert payload["ratee_id"] == 42
    assert fake_conn.committed is True
    assert not fake_conn.cursor_obj.steps, "Not all scripted DB steps were consumed"


def test_submit_rating_rejects_repeat_submission(monkeypatch):
    steps = [
        {
            "match": "SELECT rating_id",
            "fetchone": {
                "rating_id": 11,
                "rater_id": 5,
                "ratee_id": 9,
                "status": "completed",
            },
        }
    ]
    fake_conn = FakeConnection(steps)
    monkeypatch.setattr("backend.main.get_db_connection", lambda: fake_conn)

    response = client.post(
        "/api/ratings/11/submit",
        json={"score": 4.0, "feedback": "duplicate", "rater_id": 5},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Rating already submitted"
    assert fake_conn.committed is False
    assert not fake_conn.cursor_obj.steps, "Not all scripted DB steps were consumed"

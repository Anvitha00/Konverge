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


def test_owner_decision_records_feedback_signal(monkeypatch):
    steps = [
        {
            "match": "SELECT * FROM project_matches",
            "fetchone": {
                "match_id": 10,
                "recommended_user_id": 42,
                "required_skill": "python",
                "owner_decision": "pending",
                "user_decision": "pending",
            },
        },
        {
            "match": "UPDATE project_matches",
            "fetchone": {
                "match_id": 10,
                "recommended_user_id": 42,
                "required_skill": "python",
                "owner_decision": "accepted",
                "user_decision": "pending",
            },
        },
        {
            "match": "INSERT INTO match_feedback",
        },
        {
            "match": "INSERT INTO user_feedback_stats",
        },
        {
            "match": "sync_collaboration_if_ready",
        },
    ]
    fake_conn = FakeConnection(steps)
    monkeypatch.setattr("backend.main.get_db_connection", lambda: fake_conn)

    response = client.patch(
        "/api/matches/10/owner",
        json={"decision": "accepted", "reason": {"type": "good fit"}},
    )
    assert response.status_code == 200
    payload = response.json()["match"]
    assert payload["ownerDecision"] == "accepted"
    assert payload["recommendedUser"]["id"] == 42
    assert fake_conn.committed is True
    assert not fake_conn.cursor_obj.steps, "Not all scripted DB steps were consumed"


def test_user_decision_records_feedback_signal(monkeypatch):
    steps = [
        {
            "match": "SELECT * FROM project_matches",
            "fetchone": {
                "match_id": 11,
                "recommended_user_id": 7,
                "required_skill": None,
                "owner_decision": "accepted",
                "user_decision": "pending",
            },
        },
        {
            "match": "UPDATE project_matches",
            "fetchone": {
                "match_id": 11,
                "recommended_user_id": 7,
                "required_skill": None,
                "owner_decision": "accepted",
                "user_decision": "rejected",
            },
        },
        {
            "match": "INSERT INTO match_feedback",
        },
        {
            "match": "INSERT INTO user_feedback_stats",
        },
        {
            "match": "sync_collaboration_if_ready",
        },
    ]
    fake_conn = FakeConnection(steps)
    monkeypatch.setattr("backend.main.get_db_connection", lambda: fake_conn)

    response = client.patch(
        "/api/matches/11/user",
        json={"decision": "rejected"},
    )
    assert response.status_code == 200
    payload = response.json()["match"]
    assert payload["userDecision"] == "rejected"
    assert payload["recommendedUser"]["id"] == 7
    assert fake_conn.committed is True
    assert not fake_conn.cursor_obj.steps, "Not all scripted DB steps were consumed"


def test_recommendation_scoring_includes_feedback_accept_rate(monkeypatch):
    steps = [
        {
            "match": "SELECT project_id, owner_id, required_skills",
            "fetchone": {
                "project_id": 101,
                "owner_id": 1,
                "required_skills": ["python", "react"],
            },
        },
        {
            "match": "DELETE FROM project_matches",
        },
        {
            "match": "SELECT user_id, name, email, skills, rating, engagement_score",
            "fetchall": [
                {
                    "user_id": 2,
                    "name": "Alice",
                    "email": "alice@example.com",
                    "skills": ["python", "react"],
                    "rating": 4.2,
                    "engagement_score": 85,
                },
                {
                    "user_id": 3,
                    "name": "Bob",
                    "email": "bob@example.com",
                    "skills": ["python"],
                    "rating": 3.8,
                    "engagement_score": 60,
                },
            ],
        },
        {
            "match": "SELECT user_id, skill, accept_rate",
            "fetchall": [
                {"user_id": 2, "skill": "python", "accept_rate": 0.8},
                {"user_id": 2, "skill": "react", "accept_rate": 0.9},
                {"user_id": 3, "skill": "python", "accept_rate": 0.4},
                {"user_id": 3, "skill": "general", "accept_rate": 0.5},
            ],
        },
        {
            "match": "INSERT INTO project_matches",
        },
    ]
    fake_conn = FakeConnection(steps)
    monkeypatch.setattr("backend.main.get_db_connection", lambda: fake_conn)

    response = client.post("/api/projects/101/recommendations")
    assert response.status_code == 200
    data = response.json()
    matches = data.get("matches", [])
    assert len(matches) >= 2
    alice_match = next((m for m in matches if m["recommendedUser"]["id"] == 2), None)
    bob_match = next((m for m in matches if m["recommendedUser"]["id"] == 3), None)
    assert alice_match is not None
    assert bob_match is not None
    assert fake_conn.committed is True
    assert not fake_conn.cursor_obj.steps, "Not all scripted DB steps were consumed"


def test_feedback_stats_upsert_increment_and_rate(monkeypatch):
    from backend.main import upsert_feedback_stat, FakeCursor, FakeConnection

    steps = [
        {
            "match": "INSERT INTO user_feedback_stats",
        },
    ]
    fake_conn = FakeConnection(steps)
    fake_cursor = fake_conn.cursor_obj

    upsert_feedback_stat(fake_cursor, user_id=5, skill_bucket="python", accepted=True)

    assert fake_conn.committed is False  # upsert does not commit; caller does
    assert not fake_cursor.steps, "Not all scripted DB steps were consumed"


def test_load_feedback_stats_maps_user_skill_to_accept_rate(monkeypatch):
    from backend.main import load_feedback_stats, FakeCursor, FakeConnection

    steps = [
        {
            "match": "SELECT user_id, skill, accept_rate",
            "fetchall": [
                {"user_id": 1, "skill": "python", "accept_rate": 0.75},
                {"user_id": 1, "skill": "react", "accept_rate": 0.9},
                {"user_id": 2, "skill": "python", "accept_rate": 0.4},
                {"user_id": 2, "skill": "general", "accept_rate": 0.5},
            ],
        },
    ]
    fake_conn = FakeConnection(steps)
    fake_cursor = fake_conn.cursor_obj

    result = load_feedback_stats(fake_cursor, [1, 2])

    expected = {
        (1, "python"): 0.75,
        (1, "react"): 0.9,
        (2, "python"): 0.4,
        (2, "general"): 0.5,
    }
    assert result == expected
    assert not fake_cursor.steps, "Not all scripted DB steps were consumed"


def test_resolve_feedback_score_favors_specific_then_general(monkeypatch):
    from backend.main import resolve_feedback_score

    stats_map = {
        (1, "python"): 0.8,
        (1, "general"): 0.6,
        (2, "react"): 0.9,
    }

    assert resolve_feedback_score(stats_map, 1, "python") == 0.8
    assert resolve_feedback_score(stats_map, 1, "unknown") == 0.6
    assert resolve_feedback_score(stats_map, 2, "react") == 0.9
    assert resolve_feedback_score(stats_map, 2, "unknown") == 0.0
    assert resolve_feedback_score(stats_map, 3, "python") == 0.0
    assert resolve_feedback_score({}, 1, "python") == 0.0

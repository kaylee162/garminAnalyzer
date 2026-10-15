from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.api.plan import get_today
from app.api.sync import get_garmin_source
from app.main import app
from tests.conftest import FakeGarmin, garmin_activity


@pytest.fixture
def client(db):
    garmin = FakeGarmin(
        [garmin_activity(i, f"2026-10-0{i} 07:00:00", fastestSplit_5000=1500.0) for i in (1, 3, 5)]
    )
    app.dependency_overrides[get_garmin_source] = lambda: garmin
    app.dependency_overrides[get_today] = lambda: date(2026, 10, 7)
    client = TestClient(app)
    client.post("/sync")
    yield client
    app.dependency_overrides.clear()


def _built_plan(client: TestClient) -> dict:
    return client.get("/plan", params={"race": "10k", "race_date": "2026-11-04"}).json()


def test_save_list_and_reload_a_plan(client):
    assert client.get("/plans").json() == []
    plan = _built_plan(client)

    saved = client.post("/plans", json={"name": "Turkey Trot 10K", "plan": plan})
    assert saved.status_code == 201
    body = saved.json()
    assert body["name"] == "Turkey Trot 10K"
    assert body["race"] == "10k"
    assert body["race_date"] == "2026-11-04"
    assert body["plan"]["weeks"] == plan["weeks"]

    listed = client.get("/plans").json()
    assert [p["id"] for p in listed] == [body["id"]]
    assert "plan" not in listed[0]
    assert client.get(f"/plans/{body['id']}").json()["plan"] == body["plan"]


def test_edits_are_kept_and_week_totals_follow_them(client):
    plan = _built_plan(client)
    plan_id = client.post("/plans", json={"name": "10K", "plan": plan}).json()["id"]

    week = plan["weeks"][0]
    week["workouts"][0].update(title="Hill repeats", distance_mi=5.0)
    removed = week["workouts"].pop()
    # Put the workouts out of order to check the API sorts them back.
    week["workouts"].reverse()

    updated = client.put(f"/plans/{plan_id}", json={"name": "10K v2", "plan": plan}).json()
    saved_week = updated["plan"]["weeks"][0]
    assert updated["name"] == "10K v2"
    assert saved_week["workouts"][0]["title"] == "Hill repeats"
    assert removed["date"] not in [w["date"] for w in saved_week["workouts"]]
    dates = [w["date"] for w in saved_week["workouts"]]
    assert dates == sorted(dates)
    assert saved_week["total_mi"] == round(sum(w["distance_mi"] for w in saved_week["workouts"]), 1)
    assert client.get(f"/plans/{plan_id}").json() == updated


def test_rejects_bad_plans_and_unknown_ids(client):
    plan = _built_plan(client)
    plan["weeks"][0]["workouts"][0]["distance_mi"] = -1
    assert client.post("/plans", json={"name": "10K", "plan": plan}).status_code == 422
    assert client.post("/plans", json={"name": "", "plan": _built_plan(client)}).status_code == 422
    assert client.get("/plans/999").status_code == 404
    missing = client.put("/plans/999", json={"name": "x", "plan": _built_plan(client)})
    assert missing.status_code == 404


def test_delete_a_plan(client):
    plan_id = client.post("/plans", json={"name": "10K", "plan": _built_plan(client)}).json()["id"]
    assert client.delete(f"/plans/{plan_id}").status_code == 204
    assert client.get("/plans").json() == []
    assert client.delete(f"/plans/{plan_id}").status_code == 404

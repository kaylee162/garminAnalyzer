import pytest
from fastapi.testclient import TestClient

from app.api.sync import get_garmin_source
from app.main import app
from tests.conftest import FakeGarmin, garmin_activity


@pytest.fixture
def client(db):
    garmin = FakeGarmin(
        [
            garmin_activity(1, "2026-10-01 07:00:00"),
            garmin_activity(2, "2026-10-03 07:00:00"),
            garmin_activity(3, "2026-10-02 17:00:00", type_key="road_biking"),
        ]
    )
    app.dependency_overrides[get_garmin_source] = lambda: garmin
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_sync_then_list_runs_in_miles(client):
    status = client.get("/sync/status").json()
    assert status["activity_count"] == 0
    assert status["last_sync_at"] is None

    assert client.post("/sync").json() == {"added": 3, "updated": 0, "total": 3}

    page = client.get("/activities", params={"sport": "run"}).json()
    assert page["total"] == 2
    newest = page["items"][0]
    assert newest["garmin_id"] == 2
    assert newest["distance_mi"] == pytest.approx(5.0)
    assert newest["avg_pace_s_per_mi"] == pytest.approx(528.0)  # 2640 s / 5 mi = 8:48 /mi
    assert newest["elevation_gain_ft"] == pytest.approx(98.4, abs=0.1)

    status = client.get("/sync/status").json()
    assert status["activity_count"] == 3
    assert status["display_name"] == "Test Runner"


def test_activity_detail_and_404(client):
    client.post("/sync")
    first_id = client.get("/activities").json()["items"][0]["id"]

    assert client.get(f"/activities/{first_id}").status_code == 200
    assert client.get("/activities/9999").status_code == 404


def test_sync_without_garmin_login_explains_what_to_do(db):
    response = TestClient(app).post("/sync")

    assert response.status_code == 502
    assert "GA_GARMIN_EMAIL" in response.json()["detail"]


def test_activity_details_groups_garmin_fields(client):
    client.post("/sync")
    run_id = client.get("/activities", params={"sport": "run"}).json()["items"][0]["id"]

    body = client.get(f"/activities/{run_id}/details").json()
    sections = {
        s["title"]: {i["label"]: i["display"] for i in s["items"]} for s in body["sections"]
    }

    assert sections["Overview"]["Distance"] == "5.00 mi"
    assert sections["Pace"]["Avg pace"] == "8:48 /mi"  # from averageSpeed 3.05 m/s
    assert sections["Running dynamics"]["Avg stride length"] == "1.08 m"
    assert sections["Training effect"]["Anaerobic"] == "0.0"  # a real zero is kept
    # Ids and booleans never show up as metrics.
    other = sections.get("Other", {})
    assert "Activity id" not in other
    assert client.get("/activities/9999/details").status_code == 404


def test_run_stats_average_every_run(db):
    garmin = FakeGarmin(
        [
            # Two 5 mi runs in 2640 s and one 10 mi run in 6000 s: 11280 s / 20 mi = 564 s/mi.
            garmin_activity(1, "2026-10-01 07:00:00", averageHR=140.0),
            garmin_activity(
                2, "2026-10-03 07:00:00", distance=16093.44, movingDuration=6000.0, averageHR=160.0
            ),
            garmin_activity(3, "2026-10-04 07:00:00", averageHR=None),  # no HR strap that day
            garmin_activity(4, "2026-10-02 17:00:00", type_key="road_biking", averageHR=120.0),
        ]
    )
    app.dependency_overrides[get_garmin_source] = lambda: garmin
    client = TestClient(app)
    try:
        assert client.get("/activities/stats").json() == {
            "count": 0,
            "avg_pace_s_per_mi": None,
            "avg_distance_mi": None,
            "avg_hr": None,
        }

        client.post("/sync")
        stats = client.get("/activities/stats").json()
    finally:
        app.dependency_overrides.clear()

    assert stats["count"] == 3
    assert stats["avg_pace_s_per_mi"] == pytest.approx((2640 * 2 + 6000) / 20)
    assert stats["avg_distance_mi"] == pytest.approx(20 / 3)
    assert stats["avg_hr"] == pytest.approx(150.0)  # the run without HR is skipped


def test_run_trend_lists_runs_since_a_date_oldest_first(client):
    client.post("/sync")

    points = client.get("/activities/trend", params={"since": "2026-10-01"}).json()
    assert [p["start_time_local"][:10] for p in points] == ["2026-10-01", "2026-10-03"]
    assert points[0]["avg_pace_s_per_mi"] == pytest.approx(528.0)
    assert points[0]["avg_hr"] == 148.0
    assert points[0]["max_hr"] == 171.0

    later = client.get("/activities/trend", params={"since": "2026-10-02"}).json()
    assert [p["start_time_local"][:10] for p in later] == ["2026-10-03"]  # the bike ride is left out

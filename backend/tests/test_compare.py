import pytest
from fastapi.testclient import TestClient

from app.analytics.compare import compare_activities
from app.api.sync import get_garmin_source
from app.main import app
from app.models import Activity
from tests.conftest import FakeGarmin, garmin_activity


@pytest.fixture
def client(db):
    garmin = FakeGarmin(
        [
            garmin_activity(1, "2026-10-01 07:00:00"),
            # Same distance, faster, higher HR and power; no power meter data for cadence.
            garmin_activity(
                2,
                "2026-10-04 07:00:00",
                movingDuration=2400.0,
                averageHR=164.6,
                maxHR=171.0,
                avgPower=249.63,
            ),
        ]
    )
    app.dependency_overrides[get_garmin_source] = lambda: garmin
    client = TestClient(app)
    client.post("/sync")
    yield client
    app.dependency_overrides.clear()


def _ids(client) -> dict[int, int]:
    """garmin_id -> database id."""
    items = client.get("/activities").json()["items"]
    return {item["garmin_id"]: item["id"] for item in items}


def _metrics(body) -> dict[str, dict]:
    return {m["key"]: m for m in body["metrics"]}


def test_compare_reports_numbers_percents_and_summaries(client):
    ids = _ids(client)
    body = client.get("/activities/compare", params={"a": ids[1], "b": ids[2]}).json()

    assert body["earlier"]["garmin_id"] == 1
    assert body["later"]["garmin_id"] == 2
    assert body["days_between"] == pytest.approx(3.0)

    metrics = _metrics(body)
    hr = metrics["avg_hr"]
    assert hr["earlier"] == 148.0 and hr["later"] == 164.6
    assert hr["change"] == pytest.approx(16.6)
    assert hr["percent_change"] == pytest.approx(11.2, abs=0.05)
    assert hr["verdict"] is None  # heart rate alone is neither better nor worse
    assert hr["summary"] == "Avg heart rate increased 11.2% (+17 bpm)"

    power = metrics["avg_power"]
    assert power["percent_change"] == pytest.approx(1.89, abs=0.005)
    assert power["verdict"] == "improved"
    assert power["summary"] == "Avg power increased 1.9% (+5 W)"

    pace = metrics["avg_pace_s_per_mi"]
    assert pace["change"] == pytest.approx(-48.0)  # 528 -> 480 s/mi
    assert pace["verdict"] == "improved"
    assert pace["summary"] == "Avg pace quickened 9.1% (−0:48 /mi)"

    assert metrics["max_hr"]["verdict"] == "unchanged"
    assert metrics["max_hr"]["summary"] == "Max heart rate unchanged (171 bpm)"


def test_compare_is_order_independent(client):
    ids = _ids(client)
    forward = client.get("/activities/compare", params={"a": ids[1], "b": ids[2]}).json()
    backward = client.get("/activities/compare", params={"a": ids[2], "b": ids[1]}).json()
    assert forward == backward


def test_metric_missing_on_one_run_has_no_change():
    earlier = Activity(avg_hr=150.0, avg_power=None, elevation_gain_m=0.0)
    later = Activity(avg_hr=150.0, avg_power=250.0, elevation_gain_m=10.0)
    metrics = {m.key: m for m in compare_activities(earlier, later)}

    assert "max_hr" not in metrics  # recorded on neither run
    power = metrics["avg_power"]
    assert power.earlier is None and power.later == 250.0
    assert power.change is None and power.percent_change is None and power.summary is None

    # A zero baseline still has a change, but no percent to divide out.
    elevation = metrics["elevation_gain_ft"]
    assert elevation.change == pytest.approx(32.8, abs=0.1)
    assert elevation.percent_change is None
    assert elevation.summary == "Elevation gain increased (+33 ft)"


def test_compare_rejects_same_or_missing_activity(client):
    ids = _ids(client)
    same = client.get("/activities/compare", params={"a": ids[1], "b": ids[1]})
    assert same.status_code == 400
    missing = client.get("/activities/compare", params={"a": ids[1], "b": 9999})
    assert missing.status_code == 404

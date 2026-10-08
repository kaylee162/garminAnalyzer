from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.analytics.planner import build_plan, predict_time_s, projected_vdot, vdot
from app.api.plan import get_today
from app.api.sync import get_garmin_source
from app.main import app
from app.models import Activity
from tests.conftest import FakeGarmin, garmin_activity

TODAY = date(2026, 10, 7)


def _run(day: date, miles: float, pace_s_per_mi: float, **extra) -> Activity:
    return Activity(
        id=day.toordinal(),
        name="Run",
        start_time_local=datetime.combine(day, datetime.min.time()),
        distance_m=miles * 1609.344,
        moving_time_s=miles * pace_s_per_mi,
        avg_cadence=extra.pop("cadence", 172.0),
        raw_json=extra,
    )


def _four_weeks_of_running() -> list[Activity]:
    """Four runs a week for four weeks: three easy 4-milers at 9:00 and a 6-mile long run."""
    runs = []
    for week in range(4):
        sunday = TODAY - timedelta(days=3 + 7 * week)
        runs += [_run(sunday - timedelta(days=d), 4, 540) for d in (5, 3, 2)]
        runs.append(_run(sunday, 6, 560))
    return runs


def test_vdot_matches_daniels_tables():
    # Daniels: a 20:00 5K is VDOT ~49.8, which predicts roughly a 3:11 marathon.
    assert vdot(5000, 20 * 60) == pytest.approx(49.8, abs=0.1)
    assert predict_time_s(49.8, 42195) / 60 == pytest.approx(191.5, abs=1.5)
    assert vdot(5000, predict_time_s(45.0, 5000)) == pytest.approx(45.0, abs=1e-6)


def test_fitness_uses_the_best_effort_including_fastest_splits():
    runs = _four_weeks_of_running()
    # A 22:00 5K hiding inside an otherwise easy run beats every whole-run score.
    runs[0].raw_json = {"fastestSplit_5000": 22 * 60}

    plan = build_plan(runs, "10k", TODAY + timedelta(weeks=8), TODAY)

    assert plan.fitness.label == "Fastest 5K"
    assert plan.fitness.vdot == pytest.approx(vdot(5000, 22 * 60))
    assert plan.predicted_pace_s_per_mi == pytest.approx(plan.predicted_time_s / 6.2137, rel=1e-3)


def test_plan_counts_back_from_race_day_and_ends_with_the_race():
    race_day = TODAY + timedelta(weeks=12)
    plan = build_plan(_four_weeks_of_running(), "half_marathon", race_day, TODAY)

    assert plan.weeks_until_race == 12
    assert [w.phase for w in plan.weeks][-2:] == ["taper", "taper"]
    assert plan.weeks[0].phase == "base"
    last = plan.weeks[-1].workouts[-1]
    assert last.kind == "race" and last.date == race_day
    assert all(w.date > TODAY for week in plan.weeks for w in week.workouts)


def test_weekly_mileage_starts_near_current_and_grows_at_most_10_percent():
    plan = build_plan(_four_weeks_of_running(), "marathon", TODAY + timedelta(weeks=20), TODAY)

    # 72 miles over the 30 days since the first of those runs.
    assert plan.recent.weekly_mi == pytest.approx(72 / 30 * 7)
    assert plan.recent.runs_per_week == pytest.approx(16 / 30 * 7)
    full_weeks = [w.total_mi for w in plan.weeks[1:] if w.phase != "taper"]
    # Growth is measured from the biggest week so far, so a cutback week doesn't reset it.
    for i in range(1, len(full_weeks)):
        assert full_weeks[i] <= max(full_weeks[:i]) * 1.1 + 2.5  # rounding, minimum run lengths
    long_runs = [w.distance_mi for week in plan.weeks for w in week.workouts if w.kind == "long"]
    assert max(long_runs) <= 20


def test_projection_gains_more_for_longer_plans_and_less_fit_runners():
    assert projected_vdot(40, 0, 30, 30) == pytest.approx(40)
    assert projected_vdot(40, 16, 30, 30) > projected_vdot(40, 8, 30, 30) > 40
    # Same weeks, but fitter runners gain a smaller share, and capped mileage gains less.
    assert projected_vdot(30, 12, 30, 30) / 30 > projected_vdot(60, 12, 30, 30) / 60
    assert projected_vdot(40, 12, 15, 30) < projected_vdot(40, 12, 30, 30)
    # A full block for a beginner is worth roughly 10% at most.
    assert projected_vdot(30, 100, 30, 30) == pytest.approx(33, abs=0.01)


def test_plan_reports_today_and_race_day_times():
    race_day = TODAY + timedelta(weeks=12)
    plan = build_plan(_four_weeks_of_running(), "half_marathon", race_day, TODAY)

    assert plan.projected_vdot > plan.fitness.vdot
    assert plan.projected_time_s < plan.predicted_time_s
    race = plan.weeks[-1].workouts[-1]
    assert race.fast_s_per_mi == pytest.approx(plan.projected_pace_s_per_mi - 3)


def test_paces_are_ordered_from_easy_to_repetition():
    plan = build_plan(_four_weeks_of_running(), "5k", TODAY + timedelta(weeks=6), TODAY)
    pace = {z.key: z.fast_s_per_mi for z in plan.paces}

    assert pace["easy"] > pace["marathon"] > pace["threshold"] > pace["interval"]
    assert pace["interval"] > pace["repetition"]


def test_low_cadence_gets_a_note():
    runs = [_run(TODAY - timedelta(days=d), 3, 600, cadence=150) for d in range(1, 20, 3)]
    plan = build_plan(runs, "5k", TODAY + timedelta(weeks=6), TODAY)

    assert any("cadence" in note for note in plan.notes)


def test_rejects_past_race_dates_and_missing_runs():
    with pytest.raises(ValueError, match="after today"):
        build_plan(_four_weeks_of_running(), "5k", TODAY, TODAY)
    with pytest.raises(ValueError, match="Sync first"):
        build_plan([], "5k", TODAY + timedelta(weeks=6), TODAY)


@pytest.fixture
def client(db):
    garmin = FakeGarmin(
        [garmin_activity(i, f"2026-10-0{i} 07:00:00", fastestSplit_5000=1500.0) for i in (1, 3, 5)]
    )
    app.dependency_overrides[get_garmin_source] = lambda: garmin
    app.dependency_overrides[get_today] = lambda: TODAY
    client = TestClient(app)
    client.post("/sync")
    yield client
    app.dependency_overrides.clear()


def test_plan_endpoint(client):
    body = client.get("/plan", params={"race": "10k", "race_date": "2026-12-06"}).json()

    assert body["race_label"] == "10K"
    assert body["fitness"]["label"] == "Fastest 5K"
    assert body["recent"]["run_count"] == 3
    assert body["weeks"][-1]["workouts"][-1]["kind"] == "race"

    past = client.get("/plan", params={"race": "10k", "race_date": "2026-10-01"})
    assert past.status_code == 400
    unknown = client.get("/plan", params={"race": "ultra", "race_date": "2026-12-06"})
    assert unknown.status_code == 422

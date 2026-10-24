from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient

from app.analytics.dashboard import streak, summarize, week_start
from app.api.sync import get_garmin_source
from app.main import app
from app.models import Activity
from tests.conftest import FakeGarmin, garmin_activity

# A Friday.
TODAY = date(2026, 10, 23)


def _activity(start: str, sport: str = "run", **values) -> Activity:
    values = {"distance_m": 8046.72, "moving_time_s": 2400.0, "calories": 400, **values}
    return Activity(sport=sport, start_time_local=datetime.fromisoformat(start), **values)


def test_summary_totals_every_sport_and_period():
    activities = [
        _activity("2026-10-22 07:00", elevation_gain_m=30.48),  # this week
        # This week.
        _activity("2026-10-20 18:00", "bike", distance_m=32186.88, moving_time_s=3600.0),
        _activity("2026-10-14 07:00", "swim", distance_m=1609.344, calories=None),  # last week
        _activity(
            "2026-10-12 07:00", "other", distance_m=None, moving_time_s=None, duration_s=1800
        ),
        _activity("2025-12-30 07:00", "walk"),  # last year
    ]

    summary = summarize(activities, TODAY)

    assert summary.totals.count == 5
    assert summary.totals.time_s == 2400 * 3 + 3600 + 1800
    assert summary.totals.distance_mi == pytest.approx(5 + 20 + 1 + 5)
    assert summary.totals.elevation_gain_ft == pytest.approx(100.0)
    assert summary.totals.calories == 400 * 4  # the swim recorded none
    assert summary.active_days == 5
    assert summary.first_activity_at == datetime(2025, 12, 30, 7)

    assert summary.this_week.count == 2
    assert summary.this_week.time_s == 2400 + 3600
    assert summary.last_week.count == 2
    assert summary.this_year.count == 4

    by_sport = {s.sport: s for s in summary.sports}
    assert list(by_sport) == ["run", "walk", "bike", "swim", "other"]
    assert by_sport["bike"].longest_distance_mi == pytest.approx(20.0)
    assert by_sport["other"].distance_mi == 0
    assert by_sport["other"].longest_distance_mi is None
    assert by_sport["other"].longest_time_s == 1800.0
    assert by_sport["walk"].last_activity_at == datetime(2025, 12, 30, 7)


def test_summary_of_nothing_is_all_zeros():
    summary = summarize([], TODAY)

    assert summary.totals.count == 0
    assert summary.totals.time_s == 0
    assert summary.first_activity_at is None
    assert summary.streak.current_days == 0
    assert all(s.count == 0 and s.last_activity_at is None for s in summary.sports)
    assert len(summary.weekly) == 12


def test_weekly_volume_splits_time_by_sport_and_week():
    activities = [
        _activity("2026-10-19 07:00"),  # Monday of this week
        _activity("2026-10-21 07:00"),
        _activity("2026-10-21 18:00", "bike", moving_time_s=3600.0),
        _activity("2026-10-18 07:00"),  # Sunday, so last week
        _activity("2026-01-05 07:00"),  # too old to show
    ]

    weekly = summarize(activities, TODAY).weekly

    assert len(weekly) == 12
    assert weekly[-1].week_start == date(2026, 10, 19)
    assert weekly[-1].time_s_by_sport == {"run": 4800.0, "bike": 3600.0}
    assert weekly[-2].time_s_by_sport == {"run": 2400.0}
    assert weekly[0].week_start == date(2026, 8, 3)
    assert all(w.time_s_by_sport == {} for w in weekly[:-2])


def test_streak_stays_alive_until_today_ends():
    days = {date(2026, 10, d) for d in (1, 2, 3, 4, 10, 20, 21, 22)}

    assert streak(days, TODAY).current_days == 3  # nothing yet today, but yesterday counts
    assert streak(days, TODAY).longest_days == 4
    assert streak(days | {TODAY}, TODAY).current_days == 4
    assert streak(days, date(2026, 10, 24)).current_days == 0  # a full day missed


def test_week_starts_on_monday():
    assert week_start(date(2026, 10, 25)) == date(2026, 10, 19)  # Sunday
    assert week_start(date(2026, 10, 19)) == date(2026, 10, 19)


def test_dashboard_endpoint_includes_recent_activities(db):
    garmin = FakeGarmin(
        [garmin_activity(i, f"2026-10-0{i} 07:00:00") for i in range(1, 8)]
        + [garmin_activity(8, "2026-10-08 17:00:00", type_key="road_biking")]
    )
    app.dependency_overrides[get_garmin_source] = lambda: garmin
    client = TestClient(app)
    try:
        assert client.get("/dashboard").json()["totals"]["count"] == 0
        client.post("/sync")
        body = client.get("/dashboard").json()
    finally:
        app.dependency_overrides.clear()

    assert body["totals"]["count"] == 8
    assert body["totals"]["distance_mi"] == pytest.approx(40.0)
    assert [a["garmin_id"] for a in body["recent"]] == [8, 7, 6, 5, 4]
    assert {s["sport"]: s["count"] for s in body["sports"]}["bike"] == 1

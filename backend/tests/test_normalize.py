from datetime import UTC, datetime

from app.sync.normalize import normalize_activity, sport_for
from tests.conftest import garmin_activity


def test_sport_groups_garmin_types():
    assert sport_for("running") == "run"
    assert sport_for("treadmill_running") == "run"
    assert sport_for("trail_running") == "run"
    assert sport_for("road_biking") == "bike"
    assert sport_for("indoor_cycling") == "bike"
    assert sport_for("virtual_ride") == "bike"
    assert sport_for("strength_training") == "other"


def test_normalize_maps_fields_and_units():
    row = normalize_activity(garmin_activity(42, "2026-10-01 12:30:00"))

    assert row["garmin_id"] == 42
    assert row["sport"] == "run"
    assert row["start_time"] == datetime(2026, 10, 1, 12, 30, tzinfo=UTC)
    assert row["distance_m"] == 8046.72
    assert row["avg_cadence"] == 168.0
    assert row["avg_stride_m"] == 1.085  # Garmin sends centimeters
    # Garmin reports 0 for things it did not measure.
    assert row["anaerobic_te"] is None


def test_normalize_handles_missing_metrics():
    raw = garmin_activity(7, "2026-10-01 12:30:00", type_key="strength_training")
    for key in ("distance", "averageHR", "avgPower", "avgStrideLength", "calories"):
        raw.pop(key)

    row = normalize_activity(raw)

    assert row["sport"] == "other"
    assert row["distance_m"] is None
    assert row["avg_hr"] is None
    assert row["avg_stride_m"] is None
    assert row["calories"] is None

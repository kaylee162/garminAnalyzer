"""Turn Garmin's activity JSON into the typed columns of the Activity table.

Pure functions: no network or database, so they are easy to test with saved Garmin JSON.
"""

from datetime import UTC, datetime
from typing import Any

_TIME_FORMAT = "%Y-%m-%d %H:%M:%S"


def sport_for(activity_type: str) -> str:
    """Group Garmin's many activity types into "run", "bike" or "other"."""
    key = activity_type.lower()
    if "run" in key:  # running, trail_running, treadmill_running, track_running, ...
        return "run"
    if "cycl" in key or "bik" in key or "ride" in key:  # cycling, road_biking, virtual_ride
        return "bike"
    return "other"


def normalize_activity(raw: dict[str, Any]) -> dict[str, Any]:
    """Map one item from Garmin's activity list to Activity column values."""
    activity_type = (raw.get("activityType") or {}).get("typeKey") or "other"
    stride_cm = _number(raw.get("avgStrideLength"))
    cadence = _number(raw.get("averageRunningCadenceInStepsPerMinute")) or _number(
        raw.get("averageBikingCadenceInRevPerMinute")
    )
    return {
        "garmin_id": int(raw["activityId"]),
        "name": raw.get("activityName"),
        "sport": sport_for(activity_type),
        "activity_type": activity_type,
        "start_time": datetime.strptime(raw["startTimeGMT"], _TIME_FORMAT).replace(tzinfo=UTC),
        "start_time_local": datetime.strptime(raw["startTimeLocal"], _TIME_FORMAT),
        "duration_s": _number(raw.get("duration")),
        "moving_time_s": _number(raw.get("movingDuration")),
        "distance_m": _number(raw.get("distance")),
        "elevation_gain_m": _number(raw.get("elevationGain")),
        "avg_speed_mps": _number(raw.get("averageSpeed")),
        "avg_hr": _number(raw.get("averageHR")),
        "max_hr": _number(raw.get("maxHR")),
        "avg_cadence": cadence,
        "avg_power": _number(raw.get("avgPower")),
        "avg_stride_m": stride_cm / 100 if stride_cm is not None else None,
        "aerobic_te": _number(raw.get("aerobicTrainingEffect")),
        "anaerobic_te": _number(raw.get("anaerobicTrainingEffect")),
        "calories": int(raw["calories"]) if raw.get("calories") is not None else None,
        "raw_json": raw,
    }


def _number(value: Any) -> float | None:
    """Garmin sends 0 or null for metrics a device didn't record; treat both as missing."""
    if value is None:
        return None
    number = float(value)
    return number if number != 0 else None

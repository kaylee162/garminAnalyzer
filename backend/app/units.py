"""Unit conversions. Data is stored in metric; the API reports miles and feet."""

METERS_PER_MILE = 1609.344
FEET_PER_METER = 3.28084


def meters_to_miles(meters: float | None) -> float | None:
    return meters / METERS_PER_MILE if meters is not None else None


def meters_to_feet(meters: float | None) -> float | None:
    return meters * FEET_PER_METER if meters is not None else None


def pace_s_per_mile(distance_m: float | None, time_s: float | None) -> float | None:
    """Seconds per mile, or None when there is no distance (e.g. strength workouts)."""
    if not distance_m or not time_s:
        return None
    return time_s / (distance_m / METERS_PER_MILE)

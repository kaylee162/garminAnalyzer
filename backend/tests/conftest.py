import os
import tempfile

import pytest

# Use an in-memory database for tests so they never touch the real data file, and make sure
# a real Garmin login in backend/.env is never picked up.
os.environ.setdefault("GA_DATABASE_URL", "sqlite://")
os.environ["GA_GARMIN_EMAIL"] = ""
os.environ["GA_GARMIN_PASSWORD"] = ""
os.environ["GA_GARMIN_TOKEN_DIR"] = tempfile.mkdtemp()

from app.db import SessionLocal, engine  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture
def db():
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        yield session
    Base.metadata.drop_all(engine)


def garmin_activity(activity_id: int, start: str, type_key: str = "running", **extra) -> dict:
    """A trimmed item from Garmin's activity list, as the garminconnect library returns it."""
    return {
        "activityId": activity_id,
        "activityName": f"Run {activity_id}",
        "startTimeLocal": start,
        "startTimeGMT": start,
        "activityType": {"typeKey": type_key},
        "distance": 8046.72,  # 5 miles
        "duration": 2700.0,
        "movingDuration": 2640.0,
        "elevationGain": 30.0,
        "averageSpeed": 3.05,
        "averageHR": 148.0,
        "maxHR": 171.0,
        "averageRunningCadenceInStepsPerMinute": 168.0,
        "avgPower": 245.0,
        "avgStrideLength": 108.5,
        "aerobicTrainingEffect": 3.1,
        "anaerobicTrainingEffect": 0.0,
        "calories": 410,
        **extra,
    }


class FakeGarmin:
    """Stands in for Garmin Connect: serves a fixed list of activities, newest first."""

    def __init__(self, activities: list[dict]):
        self.activities = sorted(activities, key=lambda a: a["startTimeGMT"], reverse=True)
        self.pages_requested = 0

    def display_name(self) -> str | None:
        return "Test Runner"

    def activities_page(self, start: int, limit: int) -> list[dict]:
        self.pages_requested += 1
        return self.activities[start : start + limit]

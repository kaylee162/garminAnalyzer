from datetime import datetime, timedelta

from sqlalchemy import select

from app.models import Activity, GarminAccount
from app.sync import service
from app.sync.service import sync_activities
from tests.conftest import FakeGarmin, garmin_activity


def daily_runs(count: int, first_day: datetime = datetime(2026, 1, 1)) -> list[dict]:
    return [
        garmin_activity(1000 + i, (first_day + timedelta(days=i)).strftime("%Y-%m-%d 07:00:00"))
        for i in range(count)
    ]


def test_first_sync_backfills_all_pages(db, monkeypatch):
    monkeypatch.setattr(service, "PAGE_SIZE", 10)
    garmin = FakeGarmin(daily_runs(25))

    result = sync_activities(db, garmin, page_delay_s=0)

    assert (result.added, result.updated, result.total) == (25, 0, 25)
    assert garmin.pages_requested == 3
    account = db.scalar(select(GarminAccount))
    assert account.display_name == "Test Runner"
    assert account.last_sync_at is not None


def test_later_sync_only_fetches_recent_pages(db, monkeypatch):
    monkeypatch.setattr(service, "PAGE_SIZE", 10)
    runs = daily_runs(40)
    sync_activities(db, FakeGarmin(runs), page_delay_s=0)

    new_run = garmin_activity(5000, "2026-02-15 07:00:00")
    renamed = {**runs[-1], "activityName": "Renamed"}
    garmin = FakeGarmin([*runs[:-1], renamed, new_run])
    result = sync_activities(db, garmin, page_delay_s=0)

    assert result.added == 1
    assert result.total == 41
    assert garmin.pages_requested == 1  # stopped once it reached already-synced days
    renamed_row = db.scalar(select(Activity).where(Activity.garmin_id == renamed["activityId"]))
    assert renamed_row.name == "Renamed"

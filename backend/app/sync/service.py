"""Fetch activities from Garmin and save them, adding new ones and updating changed ones."""

import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Activity, GarminAccount, User
from app.sync.garmin import GarminSource
from app.sync.normalize import normalize_activity

PAGE_SIZE = 100
# Re-check recent days on every sync in case an activity was edited on Garmin (renamed, cropped).
RECHECK_DAYS = 3
# Short pause between pages so a full back-fill stays polite to Garmin's servers.
PAGE_DELAY_S = 0.5


@dataclass
class SyncResult:
    added: int
    updated: int
    total: int


def get_default_user(db: Session) -> User:
    """Single-user app for now: user 1, created on first use."""
    user = db.get(User, 1)
    if user is None:
        user = User(id=1, name="Me")
        db.add(user)
        db.flush()
    return user


def get_account(db: Session, user_id: int) -> GarminAccount | None:
    return db.scalar(select(GarminAccount).where(GarminAccount.user_id == user_id))


def sync_activities(
    db: Session, source: GarminSource, *, full: bool = False, page_delay_s: float = PAGE_DELAY_S
) -> SyncResult:
    """Pull activities newest first until reaching ones already stored.

    The first sync (or full=True) walks the whole history.
    """
    user = get_default_user(db)
    latest = db.scalar(select(func.max(Activity.start_time)).where(Activity.user_id == user.id))
    cutoff = None
    if latest is not None and not full:
        cutoff = _as_utc(latest) - timedelta(days=RECHECK_DAYS)

    added = updated = 0
    start = 0
    while True:
        page = source.activities_page(start, PAGE_SIZE)
        if not page:
            break
        rows = [normalize_activity(raw) for raw in page]
        existing = {
            a.garmin_id: a
            for a in db.scalars(
                select(Activity).where(Activity.garmin_id.in_([r["garmin_id"] for r in rows]))
            )
        }
        for row in rows:
            if cutoff is not None and row["start_time"] < cutoff:
                continue
            activity = existing.get(row["garmin_id"])
            if activity is None:
                db.add(Activity(user_id=user.id, **row))
                added += 1
            else:
                for key, value in row.items():
                    setattr(activity, key, value)
                updated += 1
        db.flush()

        reached_cutoff = cutoff is not None and min(r["start_time"] for r in rows) < cutoff
        if reached_cutoff or len(page) < PAGE_SIZE:
            break
        start += PAGE_SIZE
        time.sleep(page_delay_s)

    account = get_account(db, user.id) or GarminAccount(user_id=user.id)
    account.last_sync_at = datetime.now(UTC)
    account.display_name = source.display_name() or account.display_name
    db.add(account)
    db.commit()

    total = db.scalar(select(func.count()).select_from(Activity).where(Activity.user_id == user.id))
    return SyncResult(added=added, updated=updated, total=total or 0)


def _as_utc(value: datetime) -> datetime:
    # SQLite gives datetimes back without a timezone; everything is stored in UTC.
    return value if value.tzinfo else value.replace(tzinfo=UTC)

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, defer

from app.analytics.dashboard import DashboardSummary, summarize
from app.api.activities import ActivitySummary
from app.db import get_db
from app.models import Activity
from app.sync.service import get_default_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

RECENT_COUNT = 5


class Dashboard(DashboardSummary):
    # The newest activities of any sport, newest first.
    recent: list[ActivitySummary]


@router.get("", response_model=Dashboard, operation_id="getDashboard")
def get_dashboard(db: Annotated[Session, Depends(get_db)]) -> Dashboard:
    """A synopsis of every synced activity: totals, per sport, this week, streaks, weekly volume."""
    user = get_default_user(db)
    # Newest first; the raw Garmin JSON isn't needed and is the bulk of each row.
    activities = list(
        db.scalars(
            select(Activity)
            .options(defer(Activity.raw_json))
            .where(Activity.user_id == user.id)
            .order_by(Activity.start_time.desc())
        )
    )
    # The server runs on the user's machine, so its date is the user's date.
    summary = summarize(activities, date.today())
    return Dashboard(
        **summary.model_dump(),
        recent=[ActivitySummary.from_activity(a) for a in activities[:RECENT_COUNT]],
    )

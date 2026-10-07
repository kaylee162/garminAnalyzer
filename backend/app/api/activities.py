from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.compare import MetricComparison, compare_activities
from app.db import get_db
from app.models import Activity
from app.sync.service import get_default_user
from app.units import meters_to_feet, meters_to_miles, pace_s_per_mile

router = APIRouter(prefix="/activities", tags=["activities"])

Sport = Literal["run", "bike", "other"]


class ActivitySummary(BaseModel):
    id: int
    garmin_id: int
    name: str | None
    sport: str
    activity_type: str
    start_time_local: datetime
    distance_mi: float | None
    duration_s: float | None
    moving_time_s: float | None
    # Seconds per mile, from moving time (falls back to total time).
    avg_pace_s_per_mi: float | None
    elevation_gain_ft: float | None
    avg_hr: float | None
    max_hr: float | None
    avg_cadence: float | None
    avg_power: float | None
    avg_stride_m: float | None
    aerobic_te: float | None
    anaerobic_te: float | None
    calories: int | None

    @classmethod
    def from_activity(cls, a: Activity) -> "ActivitySummary":
        return cls(
            id=a.id,
            garmin_id=a.garmin_id,
            name=a.name,
            sport=a.sport,
            activity_type=a.activity_type,
            start_time_local=a.start_time_local,
            distance_mi=meters_to_miles(a.distance_m),
            duration_s=a.duration_s,
            moving_time_s=a.moving_time_s,
            avg_pace_s_per_mi=pace_s_per_mile(a.distance_m, a.moving_time_s or a.duration_s),
            elevation_gain_ft=meters_to_feet(a.elevation_gain_m),
            avg_hr=a.avg_hr,
            max_hr=a.max_hr,
            avg_cadence=a.avg_cadence,
            avg_power=a.avg_power,
            avg_stride_m=a.avg_stride_m,
            aerobic_te=a.aerobic_te,
            anaerobic_te=a.anaerobic_te,
            calories=a.calories,
        )


class ActivityPage(BaseModel):
    items: list[ActivitySummary]
    total: int


@router.get("", response_model=ActivityPage, operation_id="listActivities")
def list_activities(
    db: Annotated[Session, Depends(get_db)],
    sport: Sport | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ActivityPage:
    """Activities newest first, optionally only one sport."""
    user = get_default_user(db)
    query = select(Activity).where(Activity.user_id == user.id)
    if sport:
        query = query.where(Activity.sport == sport)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.order_by(Activity.start_time.desc()).limit(limit).offset(offset))
    return ActivityPage(items=[ActivitySummary.from_activity(a) for a in rows], total=total)


class ActivityComparison(BaseModel):
    """Two runs side by side. The runs are put in date order and changes run earlier -> later."""

    earlier: ActivitySummary
    later: ActivitySummary
    days_between: float
    metrics: list[MetricComparison]


@router.get("/compare", response_model=ActivityComparison, operation_id="compareActivities")
def compare(
    db: Annotated[Session, Depends(get_db)],
    a: Annotated[int, Query(description="Id of one activity")],
    b: Annotated[int, Query(description="Id of the other activity")],
) -> ActivityComparison:
    """Compare two activities. Pass them in either order; the earlier one is the baseline."""
    if a == b:
        raise HTTPException(status_code=400, detail="Pick two different activities to compare")
    earlier, later = sorted((_get_owned(db, a), _get_owned(db, b)), key=lambda x: x.start_time)
    return ActivityComparison(
        earlier=ActivitySummary.from_activity(earlier),
        later=ActivitySummary.from_activity(later),
        days_between=(later.start_time - earlier.start_time).total_seconds() / 86400,
        metrics=compare_activities(earlier, later),
    )


@router.get("/{activity_id}", response_model=ActivitySummary, operation_id="getActivity")
def get_activity(activity_id: int, db: Annotated[Session, Depends(get_db)]) -> ActivitySummary:
    return ActivitySummary.from_activity(_get_owned(db, activity_id))


def _get_owned(db: Session, activity_id: int) -> Activity:
    activity = db.get(Activity, activity_id)
    if activity is None or activity.user_id != get_default_user(db).id:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.planner import NoRunsError, Race, TrainingPlan, build_plan
from app.db import get_db
from app.models import Activity
from app.sync.service import get_default_user

router = APIRouter(prefix="/plan", tags=["plan"])


def get_today() -> date:
    """Overridden in tests so plans don't depend on the day they run."""
    return date.today()


@router.get("", response_model=TrainingPlan, operation_id="buildTrainingPlan")
def plan(
    db: Annotated[Session, Depends(get_db)],
    today: Annotated[date, Depends(get_today)],
    race: Annotated[Race, Query(description="What you're training for")],
    race_date: Annotated[date, Query(description="Race day, YYYY-MM-DD")],
) -> TrainingPlan:
    """Estimate race time from recent runs and lay out the weeks until race day.

    Nothing is stored: the plan is recalculated from your latest runs on every request.
    """
    user = get_default_user(db)
    runs = list(
        db.scalars(select(Activity).where(Activity.user_id == user.id, Activity.sport == "run"))
    )
    try:
        return build_plan(runs, race, race_date, today)
    except NoRunsError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

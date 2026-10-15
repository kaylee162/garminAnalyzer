from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.planner import Race, TrainingPlan
from app.db import get_db
from app.models import SavedTrainingPlan
from app.sync.service import get_default_user

router = APIRouter(prefix="/plans", tags=["plan"])


class SavedPlanSummary(BaseModel):
    id: int
    name: str
    race: Race
    race_date: date
    created_at: datetime
    updated_at: datetime


class SavedPlan(SavedPlanSummary):
    plan: TrainingPlan


class SavePlanRequest(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    plan: TrainingPlan


@router.get("", response_model=list[SavedPlanSummary], operation_id="listSavedPlans")
def list_plans(db: Annotated[Session, Depends(get_db)]) -> list[SavedPlanSummary]:
    """Saved plans, the soonest race first."""
    user = get_default_user(db)
    rows = db.scalars(
        select(SavedTrainingPlan)
        .where(SavedTrainingPlan.user_id == user.id)
        .order_by(SavedTrainingPlan.race_date, SavedTrainingPlan.id)
    )
    return [_summary(row) for row in rows]


@router.post("", response_model=SavedPlan, status_code=201, operation_id="savePlan")
def save_plan(body: SavePlanRequest, db: Annotated[Session, Depends(get_db)]) -> SavedPlan:
    """Save a plan (usually one from GET /plan, possibly edited) so it is kept as-is."""
    row = SavedTrainingPlan(user_id=get_default_user(db).id)
    _apply(row, body)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _saved(row)


@router.get("/{plan_id}", response_model=SavedPlan, operation_id="getSavedPlan")
def get_plan(plan_id: int, db: Annotated[Session, Depends(get_db)]) -> SavedPlan:
    return _saved(_get_owned(db, plan_id))


@router.put("/{plan_id}", response_model=SavedPlan, operation_id="updateSavedPlan")
def update_plan(
    plan_id: int, body: SavePlanRequest, db: Annotated[Session, Depends(get_db)]
) -> SavedPlan:
    """Replace a saved plan with an edited version."""
    row = _get_owned(db, plan_id)
    _apply(row, body)
    db.commit()
    db.refresh(row)
    return _saved(row)


@router.delete("/{plan_id}", status_code=204, operation_id="deleteSavedPlan")
def delete_plan(plan_id: int, db: Annotated[Session, Depends(get_db)]) -> Response:
    db.delete(_get_owned(db, plan_id))
    db.commit()
    return Response(status_code=204)


def _apply(row: SavedTrainingPlan, body: SavePlanRequest) -> None:
    plan = _tidy(body.plan)
    row.name = body.name.strip() or plan.race_label
    row.race = plan.race
    row.race_date = plan.race_date
    row.plan_json = plan.model_dump(mode="json")


def _tidy(plan: TrainingPlan) -> TrainingPlan:
    """Keep edited weeks consistent: workouts in date order and week totals that add up."""
    for week in plan.weeks:
        week.workouts.sort(key=lambda w: w.date)
        week.total_mi = round(sum(w.distance_mi for w in week.workouts), 1)
    return plan


def _summary(row: SavedTrainingPlan) -> SavedPlanSummary:
    return SavedPlanSummary(
        id=row.id,
        name=row.name,
        race=row.race,
        race_date=row.race_date,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _saved(row: SavedTrainingPlan) -> SavedPlan:
    return SavedPlan(**_summary(row).model_dump(), plan=TrainingPlan.model_validate(row.plan_json))


def _get_owned(db: Session, plan_id: int) -> SavedTrainingPlan:
    row = db.get(SavedTrainingPlan, plan_id)
    if row is None or row.user_id != get_default_user(db).id:
        raise HTTPException(status_code=404, detail="Saved plan not found")
    return row

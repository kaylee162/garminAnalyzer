from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import Activity
from app.sync.garmin import GarminError, GarminSource, connect, is_configured
from app.sync.service import get_account, get_default_user, sync_activities

router = APIRouter(prefix="/sync", tags=["sync"])


class SyncStatus(BaseModel):
    # True once a login has saved tokens, or credentials are in .env.
    configured: bool
    display_name: str | None
    last_sync_at: datetime | None
    activity_count: int


class SyncResultOut(BaseModel):
    added: int
    updated: int
    total: int


class GarminProblem(BaseModel):
    detail: str


def get_garmin_source(settings: Annotated[Settings, Depends(get_settings)]) -> GarminSource:
    """Separate dependency so tests can swap in a fake Garmin."""
    try:
        return connect(settings)
    except GarminError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/status", response_model=SyncStatus, operation_id="getSyncStatus")
def sync_status(
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> SyncStatus:
    user = get_default_user(db)
    account = get_account(db, user.id)
    last_sync = account.last_sync_at if account else None
    if last_sync is not None and last_sync.tzinfo is None:
        last_sync = last_sync.replace(tzinfo=UTC)
    count = db.scalar(select(func.count()).select_from(Activity).where(Activity.user_id == user.id))
    return SyncStatus(
        configured=is_configured(settings),
        display_name=account.display_name if account else None,
        last_sync_at=last_sync,
        activity_count=count or 0,
    )


@router.post(
    "",
    response_model=SyncResultOut,
    operation_id="runSync",
    responses={502: {"model": GarminProblem, "description": "Garmin login or fetch failed"}},
)
def run_sync(
    db: Annotated[Session, Depends(get_db)],
    source: Annotated[GarminSource, Depends(get_garmin_source)],
) -> SyncResultOut:
    """Fetch new activities from Garmin now."""
    try:
        result = sync_activities(db, source)
    except GarminError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return SyncResultOut(added=result.added, updated=result.updated, total=result.total)

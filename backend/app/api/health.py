from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(tags=["health"])


class Health(BaseModel):
    status: Literal["ok"]
    database: Literal["ok", "error"]
    version: str


@router.get("/health", response_model=Health, operation_id="getHealth")
def health(db: Annotated[Session, Depends(get_db)]) -> Health:
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except SQLAlchemyError:
        database = "error"
    return Health(status="ok", database=database, version="0.1.0")

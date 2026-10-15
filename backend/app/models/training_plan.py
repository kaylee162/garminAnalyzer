from datetime import date
from typing import Any

from sqlalchemy import JSON, Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SavedTrainingPlan(TimestampMixin, Base):
    """A training plan the user built, edited and saved.

    The whole plan (weeks, workouts, paces, prediction) is kept as JSON exactly as it was
    saved, so edits survive and the plan doesn't shift when new runs are synced.
    race and race_date are copied out of the JSON so plans can be listed without parsing it.
    """

    __tablename__ = "training_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    race: Mapped[str] = mapped_column(String(20))
    race_date: Mapped[date] = mapped_column(Date)
    plan_json: Mapped[dict[str, Any]] = mapped_column(JSON)

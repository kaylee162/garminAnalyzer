"""Database models. Import every model here so Alembic sees it."""

from app.models.activity import Activity
from app.models.base import Base
from app.models.garmin_account import GarminAccount
from app.models.training_plan import SavedTrainingPlan
from app.models.user import User

__all__ = ["Activity", "Base", "GarminAccount", "SavedTrainingPlan", "User"]

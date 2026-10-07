from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class User(TimestampMixin, Base):
    """One person using the app. Single user today, but every other table points here
    through user_id so more people can be added later."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    # Distances are shown in miles for now; stored as a setting so km can be added later.
    units: Mapped[str] = mapped_column(String(2), default="mi")
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")

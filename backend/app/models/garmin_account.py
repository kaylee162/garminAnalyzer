from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class GarminAccount(TimestampMixin, Base):
    """Sync state for a user's Garmin Connect account.

    Login tokens live in a file on this computer for now (see GA_GARMIN_TOKEN_DIR). When the
    app moves to Vercel they will be stored here, encrypted.
    """

    __tablename__ = "garmin_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(100))
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

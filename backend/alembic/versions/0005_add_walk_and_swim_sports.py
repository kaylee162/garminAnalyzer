"""add walk and swim sports

Walks and swims were stored with sport "other". New syncs group them as "walk" and "swim"
(see app/sync/normalize.py); this applies the same rule to activities already stored.
Runs slower than 16:00 per mile were moved to "other" by 0004; they become walks too.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-19 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        "UPDATE activities SET sport = 'walk' "
        "WHERE sport = 'other' "
        "AND (LOWER(activity_type) LIKE '%walk%' OR LOWER(activity_type) LIKE '%run%')"
    )
    op.execute(
        "UPDATE activities SET sport = 'swim' "
        "WHERE sport = 'other' AND LOWER(activity_type) LIKE '%swim%'"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("UPDATE activities SET sport = 'other' WHERE sport IN ('walk', 'swim')")

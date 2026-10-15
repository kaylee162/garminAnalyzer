"""regroup walks tracked as runs

Runs slower than 16:00 per mile were stored with sport "run". New syncs group them as
"other" (see app/sync/normalize.py); this applies the same rule to activities already stored.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-14 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Copied here rather than imported, so this migration keeps doing the same thing if the
# app's threshold changes later.
METERS_PER_MILE = 1609.344
MAX_RUN_PACE_S_PER_MI = 16 * 60


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        sa.text(
            "UPDATE activities SET sport = 'other' "
            "WHERE sport = 'run' AND distance_m > 0 "
            "AND COALESCE(moving_time_s, duration_s) > 0 "
            "AND COALESCE(moving_time_s, duration_s) / (distance_m / :m_per_mi) > :max_pace"
        ).bindparams(m_per_mi=METERS_PER_MILE, max_pace=MAX_RUN_PACE_S_PER_MI)
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Activities whose Garmin type is a kind of run go back to "run", whatever their pace.
    op.execute(
        "UPDATE activities SET sport = 'run' "
        "WHERE sport = 'other' AND LOWER(activity_type) LIKE '%run%'"
    )

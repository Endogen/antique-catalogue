"""Add structured context to activity logs.

Revision ID: 0015_add_activity_context
Revises: 0014_add_is_draft_to_items
Create Date: 2026-07-07 00:00:00
"""

import sqlalchemy as sa

from alembic import op

revision = "0015_add_activity_context"
down_revision = "0014_add_is_draft_to_items"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "activity_logs",
        sa.Column("context", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("activity_logs", "context")

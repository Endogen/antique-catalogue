"""Add is_draft flag to items.

Revision ID: 0014_add_is_draft_to_items
Revises: 0013_add_avatar_to_users
Create Date: 2026-02-17 01:00:00
"""

import sqlalchemy as sa

from alembic import op

revision = "0014_add_is_draft_to_items"
down_revision = "0013_add_avatar_to_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "items",
        sa.Column(
            "is_draft",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("items", "is_draft")

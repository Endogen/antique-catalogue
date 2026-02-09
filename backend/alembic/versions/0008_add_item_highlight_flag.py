"""Add highlight flag to items.

Revision ID: 0008_add_item_highlight_flag
Revises: 0007_add_item_featured_flag
Create Date: 2026-02-09 00:00:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0008_add_item_highlight_flag"
down_revision = "0007_add_item_featured_flag"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "items",
        sa.Column("is_highlight", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("items", "is_highlight")

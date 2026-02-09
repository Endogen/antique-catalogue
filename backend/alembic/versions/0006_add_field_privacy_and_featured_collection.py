"""Add private fields and featured collections.

Revision ID: 0006_add_field_privacy_and_featured_collection
Revises: 0005_create_item_images
Create Date: 2026-02-09 00:00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006_add_field_privacy_and_featured_collection"
down_revision = "0005_create_item_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "field_definitions",
        sa.Column("is_private", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column(
        "collections",
        sa.Column("is_featured", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("collections", "is_featured")
    op.drop_column("field_definitions", "is_private")

"""Create item images table.

Revision ID: 0005_create_item_images
Revises: 0004_create_items
Create Date: 2026-02-08 01:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0005_create_item_images"
down_revision = "0004_create_items"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "item_images",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "item_id",
            sa.Integer(),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_item_images_item_id"), "item_images", ["item_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_item_images_item_id"), table_name="item_images")
    op.drop_table("item_images")

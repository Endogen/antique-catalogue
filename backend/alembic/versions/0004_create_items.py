"""Create items table.

Revision ID: 0004_create_items
Revises: 0003_create_field_definitions
Create Date: 2026-02-08 00:30:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0004_create_items"
down_revision = "0003_create_field_definitions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "items",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "collection_id",
            sa.Integer(),
            sa.ForeignKey("collections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_items_collection_id"), "items", ["collection_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_items_collection_id"), table_name="items")
    op.drop_table("items")

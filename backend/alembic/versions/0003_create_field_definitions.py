"""Create field_definitions table.

Revision ID: 0003_create_field_definitions
Revises: 0002_create_collections
Create Date: 2026-02-08 00:20:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0003_create_field_definitions"
down_revision = "0002_create_collections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "field_definitions",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "collection_id",
            sa.Integer(),
            sa.ForeignKey("collections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("field_type", sa.String(length=20), nullable=False),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("options", sa.JSON(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
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
        sa.CheckConstraint(
            "field_type in ('text', 'number', 'date', 'timestamp', 'checkbox', 'select')",
            name="ck_field_definitions_type",
        ),
        sa.UniqueConstraint("collection_id", "name", name="uq_field_definitions_collection_name"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_field_definitions_collection_id"),
        "field_definitions",
        ["collection_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_field_definitions_collection_id"), table_name="field_definitions")
    op.drop_table("field_definitions")

"""Create collections table.

Revision ID: 0002_create_collections
Revises: 0001_create_users_email_tokens
Create Date: 2026-02-08 00:10:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0002_create_collections"
down_revision = "0001_create_users_email_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "collections",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "owner_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
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
    op.create_index(op.f("ix_collections_owner_id"), "collections", ["owner_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_collections_owner_id"), table_name="collections")
    op.drop_table("collections")

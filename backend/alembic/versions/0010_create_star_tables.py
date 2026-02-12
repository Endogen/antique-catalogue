"""Create collection and item star tables.

Revision ID: 0010_create_star_tables
Revises: 0009_create_activity_logs
Create Date: 2026-02-13 00:00:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0010_create_star_tables"
down_revision = "0009_create_activity_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "collection_stars",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("collection_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["collection_id"], ["collections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "collection_id",
            name="uq_collection_stars_user_collection",
        ),
    )
    op.create_index(
        op.f("ix_collection_stars_collection_id"),
        "collection_stars",
        ["collection_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_collection_stars_user_id"),
        "collection_stars",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_collection_stars_user_created",
        "collection_stars",
        ["user_id", "created_at"],
        unique=False,
    )

    op.create_table(
        "item_stars",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "item_id",
            name="uq_item_stars_user_item",
        ),
    )
    op.create_index(
        op.f("ix_item_stars_item_id"),
        "item_stars",
        ["item_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_item_stars_user_id"),
        "item_stars",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_item_stars_user_created",
        "item_stars",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_item_stars_user_created", table_name="item_stars")
    op.drop_index(op.f("ix_item_stars_user_id"), table_name="item_stars")
    op.drop_index(op.f("ix_item_stars_item_id"), table_name="item_stars")
    op.drop_table("item_stars")

    op.drop_index("ix_collection_stars_user_created", table_name="collection_stars")
    op.drop_index(op.f("ix_collection_stars_user_id"), table_name="collection_stars")
    op.drop_index(op.f("ix_collection_stars_collection_id"), table_name="collection_stars")
    op.drop_table("collection_stars")

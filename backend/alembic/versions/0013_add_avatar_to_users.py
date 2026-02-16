"""Add avatar_filename to users.

Revision ID: 0013_add_avatar_to_users
Revises: 0012_add_usernames_to_users
Create Date: 2026-02-16 23:00:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0013_add_avatar_to_users"
down_revision = "0012_add_usernames_to_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("avatar_filename", sa.String(length=255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("avatar_filename")

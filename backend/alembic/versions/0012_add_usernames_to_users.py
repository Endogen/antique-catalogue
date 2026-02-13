"""Add usernames to users.

Revision ID: 0012_add_usernames_to_users
Revises: 0011_create_schema_templates
Create Date: 2026-02-13 00:00:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0012_add_usernames_to_users"
down_revision = "0011_create_schema_templates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("username", sa.String(length=12), nullable=True))

    op.execute(sa.text("UPDATE users SET username = CAST(id AS TEXT) WHERE username IS NULL"))

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column("username", existing_type=sa.String(length=12), nullable=False)
        batch_op.create_unique_constraint("uq_users_username", ["username"])


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_constraint("uq_users_username", type_="unique")
        batch_op.drop_column("username")

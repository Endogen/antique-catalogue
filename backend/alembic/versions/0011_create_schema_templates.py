"""Create schema template tables.

Revision ID: 0011_create_schema_templates
Revises: 0010_create_star_tables
Create Date: 2026-02-13 00:00:00
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0011_create_schema_templates"
down_revision = "0010_create_star_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "schema_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("owner_id", "name", name="uq_schema_templates_owner_name"),
    )
    op.create_index(
        op.f("ix_schema_templates_owner_id"),
        "schema_templates",
        ["owner_id"],
        unique=False,
    )

    op.create_table(
        "schema_template_fields",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("schema_template_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("field_type", sa.String(length=20), nullable=False),
        sa.Column("is_required", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_private", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("options", sa.JSON(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "field_type in ('text', 'number', 'date', 'timestamp', 'checkbox', 'select')",
            name="ck_schema_template_fields_type",
        ),
        sa.ForeignKeyConstraint(
            ["schema_template_id"],
            ["schema_templates.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "schema_template_id",
            "name",
            name="uq_schema_template_fields_template_name",
        ),
    )
    op.create_index(
        op.f("ix_schema_template_fields_schema_template_id"),
        "schema_template_fields",
        ["schema_template_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_schema_template_fields_schema_template_id"),
        table_name="schema_template_fields",
    )
    op.drop_table("schema_template_fields")

    op.drop_index(op.f("ix_schema_templates_owner_id"), table_name="schema_templates")
    op.drop_table("schema_templates")

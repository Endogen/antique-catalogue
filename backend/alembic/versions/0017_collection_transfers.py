"""Durable resumable uploads and idempotent collection restores."""

import sqlalchemy as sa

from alembic import op

revision = "0017_collection_transfers"
down_revision = "0016_preserve_data_and_sessions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "upload_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("target", sa.JSON(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("received", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_upload_sessions_owner_id", "upload_sessions", ["owner_id"])
    op.create_table(
        "archive_restores",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("digest", sa.String(64), nullable=False),
        sa.Column(
            "collection_id", sa.Integer(), sa.ForeignKey("collections.id", ondelete="SET NULL")
        ),
    )
    op.create_index("ix_archive_restores_owner_id", "archive_restores", ["owner_id"])


def downgrade():
    op.drop_table("archive_restores")
    op.drop_table("upload_sessions")

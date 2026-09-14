"""Preserve unmapped metadata privately and support revocable sessions."""

import sqlalchemy as sa

from alembic import op

revision = "0016_preserve_data_and_sessions"
down_revision = "0015_add_activity_context"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("session_version", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column(
        "items", sa.Column("preserved_metadata", sa.JSON(), nullable=False, server_default="[]")
    )
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("refresh_id", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    # Quarantine historical orphan keys before future fields can reuse their names.
    items = sa.table(
        "items",
        sa.column("id", sa.Integer()),
        sa.column("collection_id", sa.Integer()),
        sa.column("metadata", sa.JSON()),
        sa.column("preserved_metadata", sa.JSON()),
    )
    fields = sa.table(
        "field_definitions",
        sa.column("collection_id", sa.Integer()),
        sa.column("name", sa.String()),
    )
    connection = op.get_bind()
    names: dict[int, set[str]] = {}
    for cid, name in connection.execute(sa.select(fields.c.collection_id, fields.c.name)):
        names.setdefault(cid, set()).add(name)
    for iid, cid, metadata in connection.execute(
        sa.select(items.c.id, items.c.collection_id, items.c.metadata)
    ).all():
        if not isinstance(metadata, dict):
            continue
        orphaned = {k: v for k, v in metadata.items() if k not in names.get(cid, set())}
        if orphaned:
            preserved = [
                {"name": k, "value": v, "reason": "Unassigned field"} for k, v in orphaned.items()
            ]
            connection.execute(
                items.update()
                .where(items.c.id == iid)
                .values(
                    metadata={k: v for k, v in metadata.items() if k not in orphaned},
                    preserved_metadata=preserved,
                )
            )


def downgrade() -> None:
    # Never discard preserved values when reverting the schema.
    items = sa.table(
        "items",
        sa.column("id", sa.Integer()),
        sa.column("metadata", sa.JSON()),
        sa.column("preserved_metadata", sa.JSON()),
    )
    connection = op.get_bind()
    for iid, metadata, preserved in connection.execute(sa.select(items)).all():
        values = dict(metadata or {})
        for entry in preserved or []:
            key = entry["name"]
            while key in values:
                key += " (preserved)"
            values[key] = entry["value"]
        connection.execute(items.update().where(items.c.id == iid).values(metadata=values))
    op.drop_table("auth_sessions")
    op.drop_column("items", "preserved_metadata")
    op.drop_column("users", "session_version")

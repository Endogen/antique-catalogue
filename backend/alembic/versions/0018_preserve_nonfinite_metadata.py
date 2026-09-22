"""Preserve invalid historical numbers as private, JSON-safe text."""

import math

import sqlalchemy as sa

from alembic import op

revision = "0018_preserve_nonfinite_metadata"
down_revision = "0017_collection_transfers"
branch_labels = None
depends_on = None


def _contains_nonfinite(value):
    if isinstance(value, float):
        return not math.isfinite(value)
    if isinstance(value, dict):
        return any(_contains_nonfinite(nested) for nested in value.values())
    if isinstance(value, list):
        return any(_contains_nonfinite(nested) for nested in value)
    return False


def _as_text(value):
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    if isinstance(value, dict):
        return {key: _as_text(nested) for key, nested in value.items()}
    if isinstance(value, list):
        return [_as_text(nested) for nested in value]
    return value


def upgrade():
    items = sa.table(
        "items",
        sa.column("id", sa.Integer()),
        sa.column("metadata", sa.JSON()),
        sa.column("preserved_metadata", sa.JSON()),
    )
    connection = op.get_bind()
    for iid, metadata, preserved in connection.execute(sa.select(items)).all():
        if not _contains_nonfinite(metadata) and not _contains_nonfinite(preserved):
            continue
        cleaned = dict(metadata or {})
        saved = _as_text(preserved or [])
        for key, value in (metadata or {}).items():
            if _contains_nonfinite(value):
                saved.append(
                    {
                        "name": key,
                        "value": _as_text(value),
                        "reason": "Non-finite number preserved as text",
                    }
                )
                del cleaned[key]
        connection.execute(
            items.update()
            .where(items.c.id == iid)
            .values(
                metadata=cleaned if metadata is not None else None,
                preserved_metadata=saved,
            )
        )


def downgrade():
    # Keep the preserved text: putting Infinity/NaN back would hide values again.
    pass

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog

MAX_ACTIVITY_LOGS_PER_USER = 100


def log_activity(
    db: Session,
    *,
    user_id: int,
    action_type: str,
    resource_type: str,
    summary: str,
    resource_id: int | None = None,
) -> None:
    entry = ActivityLog(
        user_id=user_id,
        action_type=action_type,
        resource_type=resource_type,
        resource_id=resource_id,
        summary=summary,
    )
    db.add(entry)
    db.flush()

    overflow_ids = (
        db.execute(
            select(ActivityLog.id)
            .where(ActivityLog.user_id == user_id)
            .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
            .offset(MAX_ACTIVITY_LOGS_PER_USER)
        )
        .scalars()
        .all()
    )
    if not overflow_ids:
        return

    db.execute(delete(ActivityLog).where(ActivityLog.id.in_(overflow_ids)))

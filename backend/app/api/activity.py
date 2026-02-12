from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.item import Item
from app.models.user import User
from app.schemas.activity import ActivityLogResponse

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=list[ActivityLogResponse])
@router.get("/", response_model=list[ActivityLogResponse], include_in_schema=False)
def list_activity(
    limit: int = Query(5, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ActivityLogResponse]:
    entries = (
        db.execute(
            select(ActivityLog)
            .where(ActivityLog.user_id == current_user.id)
            .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )

    item_ids = [
        entry.resource_id
        for entry in entries
        if entry.action_type == "item.created"
        and entry.resource_type == "item"
        and entry.resource_id is not None
    ]
    if item_ids:
        item_rows = db.execute(
            select(Item.id, Item.collection_id).where(Item.id.in_(item_ids))
        ).all()
        item_collection_map = {item_id: collection_id for item_id, collection_id in item_rows}
    else:
        item_collection_map = {}

    for entry in entries:
        target_path: str | None = None
        if entry.resource_type == "collection" and entry.resource_id is not None:
            target_path = f"/collections/{entry.resource_id}"
        elif entry.action_type == "item.created" and entry.resource_id is not None:
            collection_id = item_collection_map.get(entry.resource_id)
            if collection_id is not None:
                target_path = f"/collections/{collection_id}/items/{entry.resource_id}"
        setattr(entry, "target_path", target_path)

    return entries

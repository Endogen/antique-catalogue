from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action_type: str
    resource_type: str
    resource_id: int | None
    target_path: str | None = None
    summary: str
    created_at: datetime

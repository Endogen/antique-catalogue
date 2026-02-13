from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FeaturedItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    collection_id: int
    name: str
    owner_username: str | None = None
    notes: str | None
    primary_image_id: int | None = None
    is_highlight: bool
    created_at: datetime

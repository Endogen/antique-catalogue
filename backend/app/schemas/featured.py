from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FeaturedItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    collection_id: int
    name: str
    notes: str | None
    primary_image_id: int | None = None
    created_at: datetime

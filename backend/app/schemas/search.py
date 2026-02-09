from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ItemSearchResponse(BaseModel):
    id: int
    collection_id: int
    collection_name: str
    name: str
    notes: str | None
    primary_image_id: int | None = None
    image_count: int | None = None
    is_highlight: bool
    created_at: datetime
    updated_at: datetime

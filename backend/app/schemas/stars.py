from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class StarStatusResponse(BaseModel):
    starred: bool
    star_count: int


class StarredCollectionResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_public: bool
    item_count: int
    star_count: int
    starred_at: datetime
    target_path: str
    created_at: datetime
    updated_at: datetime


class StarredItemResponse(BaseModel):
    id: int
    collection_id: int
    collection_name: str
    name: str
    notes: str | None
    primary_image_id: int | None
    image_count: int
    star_count: int
    is_highlight: bool
    starred_at: datetime
    target_path: str
    created_at: datetime
    updated_at: datetime

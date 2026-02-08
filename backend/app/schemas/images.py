from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ItemImageUpdateRequest(BaseModel):
    position: int = Field(..., ge=0, examples=[0])


class ItemImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    filename: str
    position: int
    created_at: datetime

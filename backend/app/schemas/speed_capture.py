"""Schemas for Speed Capture endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class SpeedCaptureNewResponse(BaseModel):
    item_id: int
    item_name: str
    image_id: int
    image_count: int
    collection_id: int


class SpeedCaptureAddResponse(BaseModel):
    item_id: int
    image_id: int
    image_count: int


class SpeedCaptureSessionResponse(BaseModel):
    collection_id: int
    collection_name: str
    draft_count: int
    total_images: int

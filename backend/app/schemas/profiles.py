from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.services.usernames import normalize_username


class ProfileUpdateRequest(BaseModel):
    username: str = Field(..., examples=["collector_berlin"])

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        normalized = normalize_username(value)
        if not normalized:
            raise ValueError("Username is required")
        return normalized


class PublicProfileResponse(BaseModel):
    id: int
    username: str
    has_avatar: bool
    created_at: datetime
    public_collection_count: int
    public_item_count: int
    earned_star_count: int
    star_rank: int

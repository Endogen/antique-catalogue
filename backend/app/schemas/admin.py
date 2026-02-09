from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AdminLoginRequest(BaseModel):
    email: str = Field(..., examples=["admin@example.com"])
    password: str = Field(..., examples=["change-me"])


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class AdminStatsResponse(BaseModel):
    total_users: int
    total_collections: int
    featured_collection_id: int | None


class AdminCollectionResponse(BaseModel):
    id: int
    owner_id: int
    owner_email: str
    name: str
    description: str | None
    is_public: bool
    is_featured: bool
    created_at: datetime
    updated_at: datetime


class AdminCollectionListResponse(BaseModel):
    total_count: int
    items: list[AdminCollectionResponse]


class AdminFeatureRequest(BaseModel):
    collection_id: int | None = Field(
        None,
        description="Collection to feature; omit or null to clear",
    )

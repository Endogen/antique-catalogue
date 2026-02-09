from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class AdminFeaturedItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    collection_id: int
    name: str
    notes: str | None
    primary_image_id: int | None = None
    is_featured: bool
    created_at: datetime


class AdminFeaturedItemsRequest(BaseModel):
    item_ids: list[int] = Field(default_factory=list, description="Item ids to feature")

    @field_validator("item_ids")
    @classmethod
    def validate_item_ids(cls, value: list[int]) -> list[int]:
        if len(value) > 4:
            raise ValueError("Select up to 4 featured items")
        if len(set(value)) != len(value):
            raise ValueError("Duplicate item ids are not allowed")
        return value

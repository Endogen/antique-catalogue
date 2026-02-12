from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _normalize_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("Collection name cannot be blank")
    return normalized


def _normalize_description(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


class CollectionCreateRequest(BaseModel):
    name: str = Field(..., examples=["Vintage Cameras"])
    description: str | None = Field(None, examples=["Mid-century cameras and accessories"])
    is_public: bool = Field(False, description="Whether the collection is publicly visible")

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_name(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return _normalize_description(value)


class CollectionUpdateRequest(BaseModel):
    name: str | None = Field(None, examples=["Vintage Cameras"])
    description: str | None = Field(None, examples=["Mid-century cameras and accessories"])
    is_public: bool | None = Field(None, description="Whether the collection is publicly visible")

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_name(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return _normalize_description(value)


class CollectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    is_public: bool
    is_featured: bool
    item_count: int | None = None
    star_count: int | None = None
    created_at: datetime
    updated_at: datetime

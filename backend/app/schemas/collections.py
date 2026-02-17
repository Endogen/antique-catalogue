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
    schema_template_id: int | None = Field(
        None, description="Optional schema template ID to copy when creating the collection"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_name(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        return _normalize_description(value)

    @field_validator("schema_template_id")
    @classmethod
    def validate_schema_template_id(cls, value: int | None) -> int | None:
        if value is None:
            return None
        if value <= 0:
            raise ValueError("Schema template ID must be positive")
        return value


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


class CollectionApplyTemplateRequest(BaseModel):
    schema_template_id: int = Field(
        ...,
        description="Schema template ID to copy into an existing collection",
    )

    @field_validator("schema_template_id")
    @classmethod
    def validate_schema_template_id(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("Schema template ID must be positive")
        return value


class CollectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    owner_username: str | None = None
    is_public: bool
    is_featured: bool
    item_count: int | None = None
    star_count: int | None = None
    created_at: datetime
    updated_at: datetime

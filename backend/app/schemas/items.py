from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _normalize_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("Item name cannot be blank")
    return normalized


def _normalize_notes(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


class ItemCreateRequest(BaseModel):
    name: str = Field(..., examples=["Kodak Brownie Camera"])
    metadata: dict[str, object] | None = Field(
        None,
        description="Metadata values keyed by field name",
    )
    notes: str | None = Field(None, examples=["Purchased at estate sale"])

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_name(value)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        return _normalize_notes(value)


class ItemUpdateRequest(BaseModel):
    name: str | None = Field(None, examples=["Kodak Brownie Camera"])
    metadata: dict[str, object] | None = Field(
        None,
        description="Metadata values keyed by field name",
    )
    notes: str | None = Field(None, examples=["Updated notes"])

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_name(value)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        return _normalize_notes(value)


class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    collection_id: int
    name: str
    metadata: dict[str, object] | None = Field(None, validation_alias="metadata_")
    notes: str | None
    primary_image_id: int | None = None
    created_at: datetime
    updated_at: datetime

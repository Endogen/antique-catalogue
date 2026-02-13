from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ALLOWED_FIELD_TYPES = {"text", "number", "date", "timestamp", "checkbox", "select"}


def _normalize_template_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("Template name cannot be blank")
    return normalized


def _normalize_field_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("Field name cannot be blank")
    return normalized


def _normalize_field_type(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in ALLOWED_FIELD_TYPES:
        raise ValueError("Invalid field type")
    return normalized


def _normalize_options(value: dict[str, object] | None) -> dict[str, list[str]] | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("Options must be an object")
    options = value.get("options")
    if not isinstance(options, list):
        raise ValueError("Options must include an options list")
    normalized: list[str] = []
    for option in options:
        if not isinstance(option, str):
            raise ValueError("Options values must be strings")
        trimmed = option.strip()
        if not trimmed:
            raise ValueError("Options values cannot be blank")
        normalized.append(trimmed)
    if not normalized:
        raise ValueError("Options values cannot be empty")
    return {"options": normalized}


def _validate_unique_field_names(fields: list[SchemaTemplateFieldCreateRequest]) -> None:
    seen: set[str] = set()
    for field in fields:
        if field.name in seen:
            raise ValueError("Field name already exists")
        seen.add(field.name)


class SchemaTemplateFieldCreateRequest(BaseModel):
    name: str = Field(..., examples=["Condition"])
    field_type: str = Field(..., examples=["select"])
    is_required: bool = Field(False)
    is_private: bool = Field(False)
    options: dict[str, object] | None = Field(
        None,
        examples=[{"options": ["Excellent", "Good", "Fair", "Poor"]}],
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_field_name(value)

    @field_validator("field_type")
    @classmethod
    def validate_field_type(cls, value: str) -> str:
        return _normalize_field_type(value)

    @field_validator("options")
    @classmethod
    def validate_options(cls, value: dict[str, object] | None) -> dict[str, list[str]] | None:
        return _normalize_options(value)

    @model_validator(mode="after")
    def validate_select_options(self) -> SchemaTemplateFieldCreateRequest:
        if self.field_type == "select" and self.options is None:
            raise ValueError("Select fields require options")
        if self.field_type != "select" and self.options is not None:
            raise ValueError("Options are only allowed for select fields")
        return self


class SchemaTemplateFieldUpdateRequest(BaseModel):
    name: str | None = Field(None, examples=["Condition"])
    field_type: str | None = Field(None, examples=["text"])
    is_required: bool | None = Field(None)
    is_private: bool | None = Field(None)
    options: dict[str, object] | None = Field(
        None,
        examples=[{"options": ["Excellent", "Good", "Fair", "Poor"]}],
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_field_name(value)

    @field_validator("field_type")
    @classmethod
    def validate_field_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_field_type(value)

    @field_validator("options")
    @classmethod
    def validate_options(cls, value: dict[str, object] | None) -> dict[str, list[str]] | None:
        return _normalize_options(value)


class SchemaTemplateFieldReorderRequest(BaseModel):
    field_ids: list[int] = Field(..., examples=[[1, 2, 3]])

    @field_validator("field_ids")
    @classmethod
    def validate_field_ids(cls, value: list[int]) -> list[int]:
        if not value:
            return value
        if any(field_id <= 0 for field_id in value):
            raise ValueError("Field IDs must be positive")
        if len(set(value)) != len(value):
            raise ValueError("Field order contains duplicate ids")
        return value


class SchemaTemplateCreateRequest(BaseModel):
    name: str = Field(..., examples=["Coins"])
    fields: list[SchemaTemplateFieldCreateRequest] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _normalize_template_name(value)

    @field_validator("fields")
    @classmethod
    def validate_fields(
        cls, value: list[SchemaTemplateFieldCreateRequest]
    ) -> list[SchemaTemplateFieldCreateRequest]:
        _validate_unique_field_names(value)
        return value


class SchemaTemplateUpdateRequest(BaseModel):
    name: str | None = Field(None, examples=["Coins"])
    fields: list[SchemaTemplateFieldCreateRequest] | None = Field(None)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_template_name(value)

    @field_validator("fields")
    @classmethod
    def validate_fields(
        cls, value: list[SchemaTemplateFieldCreateRequest] | None
    ) -> list[SchemaTemplateFieldCreateRequest] | None:
        if value is None:
            return None
        _validate_unique_field_names(value)
        return value


class SchemaTemplateCopyRequest(BaseModel):
    name: str | None = Field(None, examples=["Coins (Copy)"])

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_template_name(value)


class SchemaTemplateFieldResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    schema_template_id: int
    name: str
    field_type: str
    is_required: bool
    is_private: bool
    options: dict[str, object] | None
    position: int
    created_at: datetime
    updated_at: datetime


class SchemaTemplateSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    field_count: int = 0
    created_at: datetime
    updated_at: datetime


class SchemaTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    field_count: int = 0
    fields: list[SchemaTemplateFieldResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import date, datetime
from typing import Any

from app.models.field_definition import FieldDefinition


class MetadataValidationError(ValueError):
    def __init__(self, message: str, errors: list[dict[str, str]]) -> None:
        super().__init__(message)
        self.errors = errors


def validate_metadata(
    field_definitions: Iterable[FieldDefinition],
    metadata: Mapping[str, Any] | None,
) -> dict[str, Any] | None:
    if metadata is None:
        metadata_values: dict[str, Any] = {}
        provided = False
    elif not isinstance(metadata, Mapping):
        raise MetadataValidationError(
            "Metadata must be an object",
            [{"field": "metadata", "message": "Metadata must be an object"}],
        )
    else:
        metadata_values = dict(metadata)
        provided = True

    field_by_name = {field.name: field for field in field_definitions}
    errors: list[dict[str, str]] = []
    normalized: dict[str, Any] = {}

    for key in metadata_values:
        if key not in field_by_name:
            errors.append({"field": key, "message": "Unknown field"})

    for field in field_by_name.values():
        value = metadata_values.get(field.name, None)

        if field.name not in metadata_values or value is None:
            if field.is_required:
                errors.append({"field": field.name, "message": "Field is required"})
            continue

        if field.field_type == "text":
            if not isinstance(value, str):
                errors.append({"field": field.name, "message": "Value must be a string"})
                continue
            trimmed = value.strip()
            if field.is_required and not trimmed:
                errors.append({"field": field.name, "message": "Field is required"})
                continue
            normalized[field.name] = trimmed
            continue

        if field.field_type == "number":
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                errors.append({"field": field.name, "message": "Value must be a number"})
                continue
            normalized[field.name] = value
            continue

        if field.field_type == "date":
            if not isinstance(value, str):
                errors.append({"field": field.name, "message": "Value must be a date (YYYY-MM-DD)"})
                continue
            trimmed = value.strip()
            try:
                date.fromisoformat(trimmed)
            except ValueError:
                errors.append({"field": field.name, "message": "Value must be a date (YYYY-MM-DD)"})
                continue
            normalized[field.name] = trimmed
            continue

        if field.field_type == "timestamp":
            if not isinstance(value, str):
                errors.append(
                    {
                        "field": field.name,
                        "message": "Value must be a timestamp (ISO 8601)",
                    }
                )
                continue
            trimmed = value.strip()
            if "T" not in trimmed and " " not in trimmed:
                errors.append(
                    {
                        "field": field.name,
                        "message": "Value must be a timestamp (ISO 8601)",
                    }
                )
                continue
            adjusted = trimmed[:-1] + "+00:00" if trimmed.endswith("Z") else trimmed
            try:
                datetime.fromisoformat(adjusted)
            except ValueError:
                errors.append(
                    {
                        "field": field.name,
                        "message": "Value must be a timestamp (ISO 8601)",
                    }
                )
                continue
            normalized[field.name] = trimmed
            continue

        if field.field_type == "checkbox":
            if not isinstance(value, bool):
                errors.append({"field": field.name, "message": "Value must be true or false"})
                continue
            normalized[field.name] = value
            continue

        if field.field_type == "select":
            if not isinstance(value, str):
                errors.append({"field": field.name, "message": "Value must be a string"})
                continue
            trimmed = value.strip()
            options_payload = field.options or {}
            raw_options = options_payload.get("options")
            if not isinstance(raw_options, list) or not raw_options:
                errors.append({"field": field.name, "message": "Select field is missing options"})
                continue
            if not trimmed:
                errors.append(
                    {
                        "field": field.name,
                        "message": "Value must be one of: " + ", ".join(raw_options),
                    }
                )
                continue
            if trimmed not in raw_options:
                errors.append(
                    {
                        "field": field.name,
                        "message": "Value must be one of: " + ", ".join(raw_options),
                    }
                )
                continue
            normalized[field.name] = trimmed
            continue

        errors.append({"field": field.name, "message": "Unsupported field type"})

    if errors:
        raise MetadataValidationError("Metadata validation failed", errors)

    if not normalized and not provided:
        return None
    return normalized

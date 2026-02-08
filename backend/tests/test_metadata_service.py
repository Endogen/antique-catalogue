from __future__ import annotations

import pytest

from app.models.field_definition import FieldDefinition
from app.services.metadata import MetadataValidationError, validate_metadata


def _field(
    name: str,
    field_type: str,
    is_required: bool,
    position: int,
    options: dict[str, object] | None = None,
) -> FieldDefinition:
    return FieldDefinition(
        collection_id=1,
        name=name,
        field_type=field_type,
        is_required=is_required,
        options=options,
        position=position,
    )


def test_validate_metadata_success() -> None:
    fields = [
        _field(
            "Condition",
            "select",
            True,
            1,
            options={"options": ["Excellent", "Good"]},
        ),
        _field("Year", "number", False, 2),
        _field("Purchased", "date", True, 3),
        _field("Inspected", "timestamp", False, 4),
        _field("Authentic", "checkbox", False, 5),
        _field("Notes", "text", False, 6),
    ]

    metadata = {
        "Condition": " Excellent ",
        "Year": 1920,
        "Purchased": "2024-06-15",
        "Inspected": "2024-06-15T10:15:00Z",
        "Authentic": True,
        "Notes": "  needs polish ",
    }

    normalized = validate_metadata(fields, metadata)

    assert normalized == {
        "Condition": "Excellent",
        "Year": 1920,
        "Purchased": "2024-06-15",
        "Inspected": "2024-06-15T10:15:00Z",
        "Authentic": True,
        "Notes": "needs polish",
    }


def test_validate_metadata_none_allows_optional_fields() -> None:
    fields = [_field("Notes", "text", False, 1)]

    assert validate_metadata(fields, None) is None


def test_validate_metadata_missing_required_and_unknown() -> None:
    fields = [
        _field("Condition", "text", True, 1),
        _field("Year", "number", False, 2),
    ]

    with pytest.raises(MetadataValidationError) as exc:
        validate_metadata(fields, {"Unknown": "value"})

    errors = exc.value.errors
    assert {"field": "Condition", "message": "Field is required"} in errors
    assert {"field": "Unknown", "message": "Unknown field"} in errors


def test_validate_metadata_type_errors() -> None:
    fields = [
        _field("Year", "number", False, 1),
        _field("Purchased", "date", False, 2),
        _field("Auction Time", "timestamp", False, 3),
        _field("Authentic", "checkbox", False, 4),
        _field(
            "Condition",
            "select",
            False,
            5,
            options={"options": ["Excellent"]},
        ),
        _field("Notes", "text", False, 6),
    ]

    metadata = {
        "Year": "1900",
        "Purchased": "2024/01/01",
        "Auction Time": "2024-01-01",
        "Authentic": "yes",
        "Condition": "Bad",
        "Notes": 123,
    }

    with pytest.raises(MetadataValidationError) as exc:
        validate_metadata(fields, metadata)

    errors = {error["field"]: error["message"] for error in exc.value.errors}
    assert errors["Year"] == "Value must be a number"
    assert errors["Purchased"] == "Value must be a date (YYYY-MM-DD)"
    assert errors["Auction Time"] == "Value must be a timestamp (ISO 8601)"
    assert errors["Authentic"] == "Value must be true or false"
    assert errors["Condition"] == "Value must be one of: Excellent"
    assert errors["Notes"] == "Value must be a string"

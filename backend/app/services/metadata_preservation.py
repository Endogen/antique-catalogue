"""Keep schema edits and moves from discarding or publishing historical values."""

from app.models.field_definition import FieldDefinition
from app.models.item import Item
from app.services.metadata import MetadataValidationError, validate_metadata


def preserve_values(item: Item, values: dict[str, object], reason: str) -> None:
    preserved = list(item.preserved_metadata or [])
    for name, value in values.items():
        entry = {"name": name, "value": value, "reason": reason}
        if entry not in preserved:
            preserved.append(entry)
    item.preserved_metadata = preserved


def plan_metadata_move(
    item: Item, source_fields: list[FieldDefinition], target_fields: list[FieldDefinition]
) -> dict:
    source = {field.name: field for field in source_fields}
    target = {field.name: field for field in target_fields}
    transferred: dict[str, object] = {}
    preserved: dict[str, object] = {}
    for name, value in (item.metadata_ or {}).items():
        old, new = source.get(name), target.get(name)
        safe = (
            old
            and new
            and old.field_type == new.field_type
            and not (old.is_private and not new.is_private)
        )
        if safe:
            try:
                validate_metadata([new], {name: value})
            except MetadataValidationError:
                safe = False
        (transferred if safe else preserved)[name] = value
    try:
        validate_metadata(target_fields, transferred)
        missing = []
    except MetadataValidationError as exc:
        missing = [error["field"] for error in exc.errors]
    return {"metadata": transferred, "preserved": preserved, "missing_fields": missing}

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.collection import Collection
from app.models.field_definition import FieldDefinition
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.user import User
from app.schemas.items import ItemCreateRequest, ItemResponse, ItemUpdateRequest
from app.schemas.responses import MessageResponse
from app.services.metadata import MetadataValidationError, validate_metadata

router = APIRouter(prefix="/collections/{collection_id}/items", tags=["items"])
public_router = APIRouter(
    prefix="/public/collections/{collection_id}/items",
    tags=["public items"],
)


def _get_collection_or_404(db: Session, collection_id: int, owner_id: int) -> Collection:
    collection = (
        db.execute(
            select(Collection).where(
                Collection.id == collection_id, Collection.owner_id == owner_id
            )
        )
        .scalars()
        .first()
    )
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return collection


def _get_public_collection_or_404(db: Session, collection_id: int) -> Collection:
    collection = (
        db.execute(
            select(Collection).where(Collection.id == collection_id, Collection.is_public.is_(True))
        )
        .scalars()
        .first()
    )
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return collection


def _get_item_or_404(db: Session, collection_id: int, item_id: int, owner_id: int) -> Item:
    item = (
        db.execute(
            select(Item)
            .join(Collection, Item.collection_id == Collection.id)
            .where(
                Item.id == item_id,
                Item.collection_id == collection_id,
                Collection.owner_id == owner_id,
            )
        )
        .scalars()
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


def _get_public_item_or_404(db: Session, collection_id: int, item_id: int) -> Item:
    item = (
        db.execute(
            select(Item)
            .join(Collection, Item.collection_id == Collection.id)
            .where(
                Item.id == item_id,
                Item.collection_id == collection_id,
                Collection.is_public.is_(True),
            )
        )
        .scalars()
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


def _get_field_definitions(db: Session, collection_id: int) -> list[FieldDefinition]:
    return (
        db.execute(select(FieldDefinition).where(FieldDefinition.collection_id == collection_id))
        .scalars()
        .all()
    )


def _metadata_path(field_name: str) -> str:
    escaped = field_name.replace("\\", "\\\\").replace('"', '\\"')
    return f'$."{escaped}"'


def _metadata_expr(field_name: str) -> object:
    return func.json_extract(Item.metadata_, _metadata_path(field_name))


def _parse_search_term(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _parse_filter_value(field: FieldDefinition, raw_value: str) -> object:
    value = raw_value.strip()
    if not value:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Filter value cannot be blank",
        )

    if field.field_type in {"text", "select", "date", "timestamp"}:
        if field.field_type == "select":
            options_payload = field.options or {}
            raw_options = options_payload.get("options")
            if not isinstance(raw_options, list) or not raw_options:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Select field '{field.name}' is missing options",
                )
            if value not in raw_options:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=("Filter value must be one of: " + ", ".join(map(str, raw_options))),
                )
        if field.field_type == "date":
            try:
                date.fromisoformat(value)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Filter value must be a date (YYYY-MM-DD)",
                ) from exc
        if field.field_type == "timestamp":
            if "T" not in value and " " not in value:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Filter value must be a timestamp (ISO 8601)",
                )
            adjusted = value[:-1] + "+00:00" if value.endswith("Z") else value
            try:
                datetime.fromisoformat(adjusted)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Filter value must be a timestamp (ISO 8601)",
                ) from exc
        return value

    if field.field_type == "number":
        try:
            if any(marker in value for marker in (".", "e", "E")):
                return float(value)
            return int(value)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Filter value must be a number",
            ) from exc

    if field.field_type == "checkbox":
        lowered = value.lower()
        if lowered in {"true", "1"}:
            return True
        if lowered in {"false", "0"}:
            return False
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Filter value must be true or false",
        )

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=f"Unsupported field type '{field.field_type}'",
    )


def _apply_item_filters(
    query,
    filters: list[str],
    field_by_name: dict[str, FieldDefinition],
):
    for raw_filter in filters:
        if raw_filter is None:
            continue
        if "=" not in raw_filter:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Filter must be in the format 'Field=Value'",
            )
        field_name, raw_value = raw_filter.split("=", 1)
        field_name = field_name.strip()
        if not field_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Filter field name cannot be blank",
            )
        field = field_by_name.get(field_name)
        if not field:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Unknown metadata field '{field_name}'",
            )
        value = _parse_filter_value(field, raw_value)
        query = query.where(_metadata_expr(field.name) == value)
    return query


def _apply_item_sort(
    query,
    sort: str | None,
    field_by_name: dict[str, FieldDefinition] | None,
):
    if sort is None:
        return query.order_by(Item.created_at.desc(), Item.id.desc())

    sort_value = sort.strip()
    if not sort_value:
        return query.order_by(Item.created_at.desc(), Item.id.desc())

    descending = sort_value.startswith("-")
    sort_key = sort_value[1:] if descending else sort_value

    if sort_key in {"name", "created_at"}:
        sort_expr = Item.name if sort_key == "name" else Item.created_at
    elif sort_key.startswith("metadata:") or sort_key.startswith("metadata."):
        if field_by_name is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Metadata sorting requires field definitions",
            )
        field_name = sort_key.split(":", 1)[1] if ":" in sort_key else sort_key.split(".", 1)[1]
        field_name = field_name.strip()
        if not field_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Metadata sort field cannot be blank",
            )
        field = field_by_name.get(field_name)
        if not field:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Unknown metadata field '{field_name}'",
            )
        sort_expr = _metadata_expr(field.name)
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Sort must be 'name', 'created_at', or 'metadata:<field>'",
        )

    if descending:
        sort_expr = sort_expr.desc()
    else:
        sort_expr = sort_expr.asc()
    return query.order_by(sort_expr, Item.id.desc())


def _sort_requires_field_definitions(sort: str | None) -> bool:
    if not sort:
        return False
    sort_value = sort.strip()
    if not sort_value:
        return False
    sort_key = sort_value[1:] if sort_value.startswith("-") else sort_value
    return sort_key.startswith("metadata:") or sort_key.startswith("metadata.")


def _validate_metadata_or_422(
    field_definitions: list[FieldDefinition],
    metadata: dict[str, object] | None,
) -> dict[str, object] | None:
    try:
        return validate_metadata(field_definitions, metadata)
    except MetadataValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=exc.errors,
        ) from exc


def _primary_image_id_subquery():
    return (
        select(ItemImage.id)
        .where(ItemImage.item_id == Item.id)
        .order_by(ItemImage.position.asc(), ItemImage.id.asc())
        .limit(1)
        .scalar_subquery()
    )


def _filter_public_metadata(
    metadata: dict[str, object] | None, public_fields: set[str]
) -> dict[str, object] | None:
    if not metadata:
        return None
    filtered = {key: value for key, value in metadata.items() if key in public_fields}
    return filtered or None


@router.get("", response_model=list[ItemResponse])
@router.get("/", response_model=list[ItemResponse], include_in_schema=False)
def list_items(
    collection_id: int,
    search: str | None = Query(
        None,
        description="Search term applied to item name and notes",
    ),
    filters: list[str] | None = Query(
        None,
        alias="filter",
        description="Metadata filters in the form Field=Value",
    ),
    sort: str | None = Query(
        None,
        description=(
            "Sort by 'name', 'created_at', or 'metadata:<field>' (prefix with '-' for desc)"
        ),
    ),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(50, ge=1, le=100, description="Pagination limit"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ItemResponse]:
    _get_collection_or_404(db, collection_id, current_user.id)
    filters = filters or []
    search_term = _parse_search_term(search)

    field_by_name: dict[str, FieldDefinition] | None = None
    if filters or _sort_requires_field_definitions(sort):
        field_definitions = _get_field_definitions(db, collection_id)
        field_by_name = {field.name: field for field in field_definitions}

    primary_image_id = _primary_image_id_subquery().label("primary_image_id")
    query = select(Item, primary_image_id).where(Item.collection_id == collection_id)
    if search_term:
        pattern = f"%{search_term}%"
        query = query.where(or_(Item.name.ilike(pattern), Item.notes.ilike(pattern)))
    if filters:
        query = _apply_item_filters(query, filters, field_by_name or {})

    query = _apply_item_sort(query, sort, field_by_name)
    query = query.offset(offset).limit(limit)

    rows = db.execute(query).all()
    items: list[Item] = []
    for item, image_id in rows:
        setattr(item, "primary_image_id", image_id)
        items.append(item)
    return items


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
@router.post(
    "/",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_item(
    collection_id: int,
    request: ItemCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    _get_collection_or_404(db, collection_id, current_user.id)
    field_definitions = _get_field_definitions(db, collection_id)
    metadata = _validate_metadata_or_422(field_definitions, request.metadata)

    item = Item(
        collection_id=collection_id,
        name=request.name,
        metadata_=metadata,
        notes=request.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(
    collection_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    item = _get_item_or_404(db, collection_id, item_id, current_user.id)
    image_id = db.execute(
        select(ItemImage.id)
        .where(ItemImage.item_id == item.id)
        .order_by(ItemImage.position.asc(), ItemImage.id.asc())
        .limit(1)
    ).scalar_one_or_none()
    setattr(item, "primary_image_id", image_id)
    return item


@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(
    collection_id: int,
    item_id: int,
    request: ItemUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    item = _get_item_or_404(db, collection_id, item_id, current_user.id)
    data = request.model_dump(exclude_unset=True)

    if "name" in data:
        item.name = data["name"]
    if "notes" in data:
        item.notes = data["notes"]
    if "metadata" in data:
        field_definitions = _get_field_definitions(db, collection_id)
        metadata = _validate_metadata_or_422(field_definitions, data["metadata"])
        item.metadata_ = metadata

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", response_model=MessageResponse)
def delete_item(
    collection_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    item = _get_item_or_404(db, collection_id, item_id, current_user.id)
    db.delete(item)
    db.commit()
    return MessageResponse(message="Item deleted")


@public_router.get("", response_model=list[ItemResponse])
@public_router.get("/", response_model=list[ItemResponse], include_in_schema=False)
def list_public_items(
    collection_id: int,
    search: str | None = Query(
        None,
        description="Search term applied to item name and notes",
    ),
    filters: list[str] | None = Query(
        None,
        alias="filter",
        description="Metadata filters in the form Field=Value",
    ),
    sort: str | None = Query(
        None,
        description=(
            "Sort by 'name', 'created_at', or 'metadata:<field>' (prefix with '-' for desc)"
        ),
    ),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(50, ge=1, le=100, description="Pagination limit"),
    db: Session = Depends(get_db),
) -> list[ItemResponse]:
    _get_public_collection_or_404(db, collection_id)
    filters = filters or []
    search_term = _parse_search_term(search)

    field_definitions = _get_field_definitions(db, collection_id)
    public_fields = {field.name for field in field_definitions if not field.is_private}
    field_by_name: dict[str, FieldDefinition] | None = None
    if filters or _sort_requires_field_definitions(sort):
        field_by_name = {field.name: field for field in field_definitions if not field.is_private}

    primary_image_id = _primary_image_id_subquery().label("primary_image_id")
    query = select(Item, primary_image_id).where(Item.collection_id == collection_id)
    if search_term:
        pattern = f"%{search_term}%"
        query = query.where(or_(Item.name.ilike(pattern), Item.notes.ilike(pattern)))
    if filters:
        query = _apply_item_filters(query, filters, field_by_name or {})

    query = _apply_item_sort(query, sort, field_by_name)
    query = query.offset(offset).limit(limit)

    rows = db.execute(query).all()
    items: list[Item] = []
    for item, image_id in rows:
        setattr(item, "primary_image_id", image_id)
        item.metadata_ = _filter_public_metadata(item.metadata_, public_fields)
        items.append(item)
    return items


@public_router.get("/{item_id}", response_model=ItemResponse)
def get_public_item(
    collection_id: int,
    item_id: int,
    db: Session = Depends(get_db),
) -> ItemResponse:
    item = _get_public_item_or_404(db, collection_id, item_id)
    field_definitions = _get_field_definitions(db, collection_id)
    public_fields = {field.name for field in field_definitions if not field.is_private}
    image_id = db.execute(
        select(ItemImage.id)
        .where(ItemImage.item_id == item.id)
        .order_by(ItemImage.position.asc(), ItemImage.id.asc())
        .limit(1)
    ).scalar_one_or_none()
    setattr(item, "primary_image_id", image_id)
    item.metadata_ = _filter_public_metadata(item.metadata_, public_fields)
    return item

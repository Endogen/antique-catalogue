from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.collection import Collection
from app.models.field_definition import FieldDefinition
from app.models.item import Item
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


@router.get("", response_model=list[ItemResponse])
@router.get("/", response_model=list[ItemResponse], include_in_schema=False)
def list_items(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ItemResponse]:
    _get_collection_or_404(db, collection_id, current_user.id)
    items = (
        db.execute(
            select(Item)
            .where(Item.collection_id == collection_id)
            .order_by(Item.created_at.desc(), Item.id.desc())
        )
        .scalars()
        .all()
    )
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
    db: Session = Depends(get_db),
) -> list[ItemResponse]:
    _get_public_collection_or_404(db, collection_id)
    items = (
        db.execute(
            select(Item)
            .where(Item.collection_id == collection_id)
            .order_by(Item.created_at.desc(), Item.id.desc())
        )
        .scalars()
        .all()
    )
    return items


@public_router.get("/{item_id}", response_model=ItemResponse)
def get_public_item(
    collection_id: int,
    item_id: int,
    db: Session = Depends(get_db),
) -> ItemResponse:
    item = _get_public_item_or_404(db, collection_id, item_id)
    return item

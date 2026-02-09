from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.collection import Collection
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.user import User
from app.schemas.collections import (
    CollectionCreateRequest,
    CollectionResponse,
    CollectionUpdateRequest,
)
from app.schemas.featured import FeaturedItemResponse
from app.schemas.responses import MessageResponse

router = APIRouter(prefix="/collections", tags=["collections"])
public_router = APIRouter(prefix="/public/collections", tags=["public collections"])


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


def _primary_image_id_subquery():
    return (
        select(ItemImage.id)
        .where(ItemImage.item_id == Item.id)
        .order_by(ItemImage.position.asc(), ItemImage.id.asc())
        .limit(1)
        .scalar_subquery()
    )


@router.get("", response_model=list[CollectionResponse])
@router.get("/", response_model=list[CollectionResponse], include_in_schema=False)
def list_collections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CollectionResponse]:
    item_counts = (
        select(
            Item.collection_id,
            func.count(Item.id).label("item_count"),
        )
        .group_by(Item.collection_id)
        .subquery()
    )
    rows = db.execute(
        select(Collection, func.coalesce(item_counts.c.item_count, 0))
        .outerjoin(item_counts, item_counts.c.collection_id == Collection.id)
        .where(Collection.owner_id == current_user.id)
        .order_by(Collection.created_at.desc())
    ).all()
    collections: list[Collection] = []
    for collection, count in rows:
        setattr(collection, "item_count", count)
        collections.append(collection)
    return collections


@router.post("", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
@router.post(
    "/",
    response_model=CollectionResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_collection(
    request: CollectionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CollectionResponse:
    collection = Collection(
        owner_id=current_user.id,
        name=request.name,
        description=request.description,
        is_public=request.is_public,
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection


@router.get("/{collection_id}", response_model=CollectionResponse)
def get_collection(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CollectionResponse:
    collection = _get_collection_or_404(db, collection_id, current_user.id)
    count = db.execute(
        select(func.count(Item.id)).where(Item.collection_id == collection.id)
    ).scalar_one()
    setattr(collection, "item_count", count)
    return collection


@router.patch("/{collection_id}", response_model=CollectionResponse)
def update_collection(
    collection_id: int,
    request: CollectionUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CollectionResponse:
    collection = _get_collection_or_404(db, collection_id, current_user.id)
    data = request.model_dump(exclude_unset=True)

    if "name" in data:
        collection.name = data["name"]
    if "description" in data:
        collection.description = data["description"]
    if "is_public" in data:
        collection.is_public = data["is_public"]

    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection


@router.delete("/{collection_id}", response_model=MessageResponse)
def delete_collection(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    collection = _get_collection_or_404(db, collection_id, current_user.id)
    db.delete(collection)
    db.commit()
    return MessageResponse(message="Collection deleted")


@public_router.get("", response_model=list[CollectionResponse])
@public_router.get("/", response_model=list[CollectionResponse], include_in_schema=False)
def list_public_collections(db: Session = Depends(get_db)) -> list[CollectionResponse]:
    item_counts = (
        select(
            Item.collection_id,
            func.count(Item.id).label("item_count"),
        )
        .group_by(Item.collection_id)
        .subquery()
    )
    rows = db.execute(
        select(Collection, func.coalesce(item_counts.c.item_count, 0))
        .outerjoin(item_counts, item_counts.c.collection_id == Collection.id)
        .where(Collection.is_public.is_(True))
        .order_by(Collection.created_at.desc())
    ).all()
    collections: list[Collection] = []
    for collection, count in rows:
        setattr(collection, "item_count", count)
        collections.append(collection)
    return collections


@public_router.get("/featured", response_model=CollectionResponse | None)
def get_featured_collection(db: Session = Depends(get_db)) -> CollectionResponse | None:
    collection = (
        db.execute(
            select(Collection)
            .where(Collection.is_public.is_(True), Collection.is_featured.is_(True))
            .order_by(Collection.updated_at.desc(), Collection.id.desc())
        )
        .scalars()
        .first()
    )
    return collection


@public_router.get("/featured/items", response_model=list[FeaturedItemResponse])
def get_featured_collection_items(db: Session = Depends(get_db)) -> list[FeaturedItemResponse]:
    collection_id = db.execute(
        select(Collection.id)
        .where(Collection.is_public.is_(True), Collection.is_featured.is_(True))
        .order_by(Collection.updated_at.desc(), Collection.id.desc())
    ).scalar_one_or_none()
    if not collection_id:
        return []

    primary_image_id = _primary_image_id_subquery().label("primary_image_id")
    rows = db.execute(
        select(Item, primary_image_id)
        .where(Item.collection_id == collection_id, Item.is_featured.is_(True))
        .order_by(Item.created_at.desc(), Item.id.desc())
        .limit(4)
    ).all()
    items: list[Item] = []
    for item, image_id in rows:
        setattr(item, "primary_image_id", image_id)
        items.append(item)
    return items


@public_router.get("/{collection_id}", response_model=CollectionResponse)
def get_public_collection(collection_id: int, db: Session = Depends(get_db)) -> CollectionResponse:
    collection = _get_public_collection_or_404(db, collection_id)
    count = db.execute(
        select(func.count(Item.id)).where(Item.collection_id == collection.id)
    ).scalar_one()
    setattr(collection, "item_count", count)
    return collection

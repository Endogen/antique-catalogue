from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.collection import Collection
from app.models.collection_star import CollectionStar
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.item_star import ItemStar
from app.models.user import User
from app.schemas.stars import (
    StarredCollectionResponse,
    StarredItemResponse,
    StarStatusResponse,
)
from app.services.activity import log_activity

router = APIRouter(prefix="/stars", tags=["stars"])


def _collection_star_count(collection_id: int):
    return select(func.count(CollectionStar.id)).where(
        CollectionStar.collection_id == collection_id
    )


def _item_star_count(item_id: int):
    return select(func.count(ItemStar.id)).where(ItemStar.item_id == item_id)


def _get_collection_for_star_or_404(db: Session, collection_id: int, user_id: int) -> Collection:
    collection = (
        db.execute(
            select(Collection).where(
                Collection.id == collection_id,
                or_(Collection.owner_id == user_id, Collection.is_public.is_(True)),
            )
        )
        .scalars()
        .first()
    )
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return collection


def _get_item_for_star_or_404(db: Session, collection_id: int, item_id: int, user_id: int) -> Item:
    item = (
        db.execute(
            select(Item)
            .join(Collection, Item.collection_id == Collection.id)
            .where(
                Item.id == item_id,
                Item.collection_id == collection_id,
                or_(Collection.owner_id == user_id, Collection.is_public.is_(True)),
            )
        )
        .scalars()
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


def _item_primary_image_subquery():
    return (
        select(ItemImage.id)
        .where(ItemImage.item_id == Item.id)
        .order_by(ItemImage.position.asc(), ItemImage.id.asc())
        .limit(1)
        .scalar_subquery()
    )


def _item_image_count_subquery():
    return select(func.count(ItemImage.id)).where(ItemImage.item_id == Item.id).scalar_subquery()


@router.get("/collections", response_model=list[StarredCollectionResponse])
def list_starred_collections(
    q: str | None = Query(None, description="Search by collection name or description"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StarredCollectionResponse]:
    item_counts = (
        select(Item.collection_id, func.count(Item.id).label("item_count"))
        .group_by(Item.collection_id)
        .subquery()
    )
    star_counts = (
        select(CollectionStar.collection_id, func.count(CollectionStar.id).label("star_count"))
        .group_by(CollectionStar.collection_id)
        .subquery()
    )

    query = (
        select(
            CollectionStar.created_at,
            Collection,
            func.coalesce(item_counts.c.item_count, 0),
            func.coalesce(star_counts.c.star_count, 0),
        )
        .join(Collection, CollectionStar.collection_id == Collection.id)
        .outerjoin(item_counts, item_counts.c.collection_id == Collection.id)
        .outerjoin(star_counts, star_counts.c.collection_id == Collection.id)
        .where(
            CollectionStar.user_id == current_user.id,
            or_(Collection.owner_id == current_user.id, Collection.is_public.is_(True)),
        )
    )

    term = q.strip() if q else ""
    if term:
        pattern = f"%{term}%"
        query = query.where(
            or_(Collection.name.ilike(pattern), Collection.description.ilike(pattern))
        )

    rows = db.execute(
        query.order_by(CollectionStar.created_at.desc(), CollectionStar.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    results: list[StarredCollectionResponse] = []
    for starred_at, collection, item_count, star_count in rows:
        target_path = (
            f"/collections/{collection.id}"
            if collection.owner_id == current_user.id
            else f"/explore/{collection.id}"
        )
        results.append(
            StarredCollectionResponse(
                id=collection.id,
                name=collection.name,
                description=collection.description,
                is_public=collection.is_public,
                item_count=item_count,
                star_count=star_count,
                starred_at=starred_at,
                target_path=target_path,
                created_at=collection.created_at,
                updated_at=collection.updated_at,
            )
        )
    return results


@router.get("/items", response_model=list[StarredItemResponse])
def list_starred_items(
    q: str | None = Query(None, description="Search by item name, notes, or collection name"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StarredItemResponse]:
    primary_image_id = _item_primary_image_subquery().label("primary_image_id")
    image_count = _item_image_count_subquery().label("image_count")
    star_counts = (
        select(ItemStar.item_id, func.count(ItemStar.id).label("star_count"))
        .group_by(ItemStar.item_id)
        .subquery()
    )

    query = (
        select(
            ItemStar.created_at,
            Item,
            Collection.name,
            Collection.owner_id,
            primary_image_id,
            image_count,
            func.coalesce(star_counts.c.star_count, 0),
        )
        .join(Item, ItemStar.item_id == Item.id)
        .join(Collection, Item.collection_id == Collection.id)
        .outerjoin(star_counts, star_counts.c.item_id == Item.id)
        .where(
            ItemStar.user_id == current_user.id,
            or_(Collection.owner_id == current_user.id, Collection.is_public.is_(True)),
        )
    )

    term = q.strip() if q else ""
    if term:
        pattern = f"%{term}%"
        query = query.where(
            or_(
                Item.name.ilike(pattern),
                Item.notes.ilike(pattern),
                Collection.name.ilike(pattern),
            )
        )

    rows = db.execute(
        query.order_by(ItemStar.created_at.desc(), ItemStar.id.desc()).offset(offset).limit(limit)
    ).all()

    results: list[StarredItemResponse] = []
    for starred_at, item, collection_name, owner_id, image_id, count, star_count in rows:
        target_path = (
            f"/collections/{item.collection_id}/items/{item.id}"
            if owner_id == current_user.id
            else f"/explore/{item.collection_id}"
        )
        results.append(
            StarredItemResponse(
                id=item.id,
                collection_id=item.collection_id,
                collection_name=collection_name,
                name=item.name,
                notes=item.notes,
                primary_image_id=image_id,
                image_count=count,
                star_count=star_count,
                is_highlight=item.is_highlight,
                starred_at=starred_at,
                target_path=target_path,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
        )

    return results


@router.get("/collections/{collection_id}", response_model=StarStatusResponse)
def get_collection_star_status(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StarStatusResponse:
    _get_collection_for_star_or_404(db, collection_id, current_user.id)
    starred = db.execute(
        select(CollectionStar.id).where(
            CollectionStar.collection_id == collection_id,
            CollectionStar.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    star_count = db.execute(_collection_star_count(collection_id)).scalar_one()
    return StarStatusResponse(starred=bool(starred), star_count=star_count)


@router.post("/collections/{collection_id}", response_model=StarStatusResponse)
def star_collection(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StarStatusResponse:
    collection = _get_collection_for_star_or_404(db, collection_id, current_user.id)
    existing = (
        db.execute(
            select(CollectionStar).where(
                CollectionStar.collection_id == collection_id,
                CollectionStar.user_id == current_user.id,
            )
        )
        .scalars()
        .first()
    )
    if existing:
        star_count = db.execute(_collection_star_count(collection_id)).scalar_one()
        return StarStatusResponse(starred=True, star_count=star_count)

    star = CollectionStar(collection_id=collection_id, user_id=current_user.id)
    db.add(star)
    db.flush()

    log_activity(
        db,
        user_id=current_user.id,
        action_type="collection.starred",
        resource_type="collection",
        resource_id=collection.id,
        summary=f'Starred collection "{collection.name}".',
    )
    if collection.owner_id != current_user.id:
        log_activity(
            db,
            user_id=collection.owner_id,
            action_type="collection.starred",
            resource_type="collection",
            resource_id=collection.id,
            summary=(f'{current_user.email} starred your collection "{collection.name}".'),
        )

    db.commit()
    star_count = db.execute(_collection_star_count(collection_id)).scalar_one()
    return StarStatusResponse(starred=True, star_count=star_count)


@router.delete("/collections/{collection_id}", response_model=StarStatusResponse)
def unstar_collection(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StarStatusResponse:
    _get_collection_for_star_or_404(db, collection_id, current_user.id)
    existing = (
        db.execute(
            select(CollectionStar).where(
                CollectionStar.collection_id == collection_id,
                CollectionStar.user_id == current_user.id,
            )
        )
        .scalars()
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()

    star_count = db.execute(_collection_star_count(collection_id)).scalar_one()
    return StarStatusResponse(starred=False, star_count=star_count)


@router.get(
    "/collections/{collection_id}/items/{item_id}",
    response_model=StarStatusResponse,
)
def get_item_star_status(
    collection_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StarStatusResponse:
    _get_item_for_star_or_404(db, collection_id, item_id, current_user.id)
    starred = db.execute(
        select(ItemStar.id).where(
            ItemStar.item_id == item_id,
            ItemStar.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    star_count = db.execute(_item_star_count(item_id)).scalar_one()
    return StarStatusResponse(starred=bool(starred), star_count=star_count)


@router.post(
    "/collections/{collection_id}/items/{item_id}",
    response_model=StarStatusResponse,
)
def star_item(
    collection_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StarStatusResponse:
    item = _get_item_for_star_or_404(db, collection_id, item_id, current_user.id)
    owner_id = db.execute(
        select(Collection.owner_id).where(Collection.id == item.collection_id)
    ).scalar_one()
    collection_name = db.execute(
        select(Collection.name).where(Collection.id == item.collection_id)
    ).scalar_one()

    existing = (
        db.execute(
            select(ItemStar).where(ItemStar.item_id == item_id, ItemStar.user_id == current_user.id)
        )
        .scalars()
        .first()
    )
    if existing:
        star_count = db.execute(_item_star_count(item_id)).scalar_one()
        return StarStatusResponse(starred=True, star_count=star_count)

    star = ItemStar(item_id=item_id, user_id=current_user.id)
    db.add(star)
    db.flush()

    log_activity(
        db,
        user_id=current_user.id,
        action_type="item.starred",
        resource_type="item",
        resource_id=item.id,
        summary=f'Starred item "{item.name}" in "{collection_name}".',
    )
    if owner_id != current_user.id:
        log_activity(
            db,
            user_id=owner_id,
            action_type="item.starred",
            resource_type="item",
            resource_id=item.id,
            summary=f'{current_user.email} starred your item "{item.name}".',
        )

    db.commit()
    star_count = db.execute(_item_star_count(item_id)).scalar_one()
    return StarStatusResponse(starred=True, star_count=star_count)


@router.delete(
    "/collections/{collection_id}/items/{item_id}",
    response_model=StarStatusResponse,
)
def unstar_item(
    collection_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StarStatusResponse:
    _get_item_for_star_or_404(db, collection_id, item_id, current_user.id)
    existing = (
        db.execute(
            select(ItemStar).where(ItemStar.item_id == item_id, ItemStar.user_id == current_user.id)
        )
        .scalars()
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()

    star_count = db.execute(_item_star_count(item_id)).scalar_one()
    return StarStatusResponse(starred=False, star_count=star_count)

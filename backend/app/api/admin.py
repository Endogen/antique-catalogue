from __future__ import annotations

import hmac
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session

from app.core.security import TokenError, create_admin_token, decode_token
from app.core.settings import settings
from app.db.session import get_db
from app.models.collection import Collection
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.user import User
from app.schemas.admin import (
    AdminCollectionListResponse,
    AdminCollectionResponse,
    AdminFeaturedItemResponse,
    AdminFeaturedItemsRequest,
    AdminFeatureRequest,
    AdminItemListResponse,
    AdminItemResponse,
    AdminLoginRequest,
    AdminStatsResponse,
    AdminTokenResponse,
    AdminUserListResponse,
    AdminUserLockRequest,
    AdminUserResponse,
)
from app.schemas.responses import MessageResponse

router = APIRouter(prefix="/admin", tags=["admin"])


def _primary_image_id_subquery():
    return (
        select(ItemImage.id)
        .where(ItemImage.item_id == Item.id)
        .order_by(ItemImage.position.asc(), ItemImage.id.asc())
        .limit(1)
        .scalar_subquery()
    )


def _item_image_count_subquery():
    return select(func.count(ItemImage.id)).where(ItemImage.item_id == Item.id).scalar_subquery()


def _collection_count_by_owner_subquery():
    return (
        select(
            Collection.owner_id.label("owner_id"),
            func.count(Collection.id).label("collection_count"),
        )
        .group_by(Collection.owner_id)
        .subquery()
    )


def _item_count_by_owner_subquery():
    return (
        select(
            Collection.owner_id.label("owner_id"),
            func.count(Item.id).label("item_count"),
        )
        .join(Item, Item.collection_id == Collection.id)
        .group_by(Collection.owner_id)
        .subquery()
    )


def _build_admin_user_response(db: Session, user: User) -> AdminUserResponse:
    collection_count = db.execute(
        select(func.count(Collection.id)).where(Collection.owner_id == user.id)
    ).scalar_one()
    item_count = db.execute(
        select(func.count(Item.id))
        .join(Collection, Item.collection_id == Collection.id)
        .where(Collection.owner_id == user.id)
    ).scalar_one()
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        is_active=user.is_active,
        is_verified=user.is_verified,
        collection_count=int(collection_count),
        item_count=int(item_count),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _require_admin_config() -> None:
    if not settings.admin_email or not settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin login is not configured",
        )


def _verify_admin_credentials(email: str, password: str) -> bool:
    if not settings.admin_email or not settings.admin_password:
        return False
    return hmac.compare_digest(email, settings.admin_email) and hmac.compare_digest(
        password, settings.admin_password
    )


def get_admin_subject(
    authorization: str | None = Header(default=None),
) -> str:
    _require_admin_config()
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    token = token.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    try:
        payload = decode_token(token)
    except TokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    if payload.get("type") != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    subject = payload.get("sub")
    if not isinstance(subject, str) or not settings.admin_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    if not hmac.compare_digest(subject, settings.admin_email):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    return subject


@router.post("/login", response_model=AdminTokenResponse)
def admin_login(request: AdminLoginRequest) -> AdminTokenResponse:
    _require_admin_config()
    if not _verify_admin_credentials(request.email, request.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    expires_delta = timedelta(minutes=settings.admin_token_expire_minutes)
    token = create_admin_token(settings.admin_email or "admin", expires_delta=expires_delta)
    return AdminTokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=int(expires_delta.total_seconds()),
    )


@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> AdminStatsResponse:
    total_users = db.execute(select(func.count(User.id))).scalar_one()
    total_collections = db.execute(select(func.count(Collection.id))).scalar_one()
    featured_collection_id = db.execute(
        select(Collection.id).where(Collection.is_featured.is_(True))
    ).scalar_one_or_none()
    return AdminStatsResponse(
        total_users=total_users,
        total_collections=total_collections,
        featured_collection_id=featured_collection_id,
    )


@router.get("/collections", response_model=AdminCollectionListResponse)
def list_admin_collections(
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    public_only: bool = Query(False, description="Only include public collections"),
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> AdminCollectionListResponse:
    total_query = select(func.count(Collection.id))
    collections_query = select(Collection, User.email).join(User, Collection.owner_id == User.id)
    if public_only:
        total_query = total_query.where(Collection.is_public.is_(True))
        collections_query = collections_query.where(Collection.is_public.is_(True))

    total_count = db.execute(total_query).scalar_one()
    rows = db.execute(
        collections_query.order_by(Collection.created_at.desc(), Collection.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    items = [
        AdminCollectionResponse(
            id=collection.id,
            owner_id=collection.owner_id,
            owner_email=email,
            name=collection.name,
            description=collection.description,
            is_public=collection.is_public,
            is_featured=collection.is_featured,
            created_at=collection.created_at,
            updated_at=collection.updated_at,
        )
        for collection, email in rows
    ]
    return AdminCollectionListResponse(total_count=total_count, items=items)


@router.delete("/collections/{collection_id}", response_model=MessageResponse)
def delete_admin_collection(
    collection_id: int,
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> MessageResponse:
    collection = db.get(Collection, collection_id)
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    db.execute(delete(Item).where(Item.collection_id == collection.id))
    db.delete(collection)
    db.commit()
    return MessageResponse(message="Collection deleted")


@router.get("/users", response_model=AdminUserListResponse)
def list_admin_users(
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    q: str | None = Query(None, description="Search by email or username"),
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> AdminUserListResponse:
    search_term = (q or "").strip()
    total_query = select(func.count(User.id))

    collection_counts = _collection_count_by_owner_subquery()
    item_counts = _item_count_by_owner_subquery()
    users_query = (
        select(
            User,
            func.coalesce(collection_counts.c.collection_count, 0),
            func.coalesce(item_counts.c.item_count, 0),
        )
        .outerjoin(collection_counts, collection_counts.c.owner_id == User.id)
        .outerjoin(item_counts, item_counts.c.owner_id == User.id)
    )

    if search_term:
        pattern = f"%{search_term}%"
        search_clause = or_(User.email.ilike(pattern), User.username.ilike(pattern))
        total_query = total_query.where(search_clause)
        users_query = users_query.where(search_clause)

    total_count = db.execute(total_query).scalar_one()
    rows = db.execute(
        users_query.order_by(User.created_at.desc(), User.id.desc()).offset(offset).limit(limit)
    ).all()
    items = [
        AdminUserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            is_active=user.is_active,
            is_verified=user.is_verified,
            collection_count=int(collection_count),
            item_count=int(item_count),
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
        for user, collection_count, item_count in rows
    ]
    return AdminUserListResponse(total_count=total_count, items=items)


@router.patch("/users/{user_id}/lock", response_model=AdminUserResponse)
def set_admin_user_lock(
    user_id: int,
    request: AdminUserLockRequest,
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = not request.locked
    db.add(user)
    db.commit()
    db.refresh(user)
    return _build_admin_user_response(db, user)


@router.delete("/users/{user_id}", response_model=MessageResponse)
def delete_admin_user(
    user_id: int,
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> MessageResponse:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    owned_collection_ids = select(Collection.id).where(Collection.owner_id == user.id)
    db.execute(delete(Item).where(Item.collection_id.in_(owned_collection_ids)))
    db.execute(delete(Collection).where(Collection.owner_id == user.id))
    db.delete(user)
    db.commit()
    return MessageResponse(message="User deleted")


@router.get("/items", response_model=AdminItemListResponse)
def list_admin_items(
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    collection_id: int | None = Query(None, ge=1, description="Filter by collection id"),
    q: str | None = Query(None, description="Search by item, collection, or owner email"),
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> AdminItemListResponse:
    search_term = (q or "").strip()
    total_query = (
        select(func.count(Item.id))
        .join(Collection, Item.collection_id == Collection.id)
        .join(User, Collection.owner_id == User.id)
    )
    image_count = _item_image_count_subquery().label("image_count")
    items_query = (
        select(
            Item,
            Collection.name,
            Collection.owner_id,
            User.email,
            image_count,
        )
        .join(Collection, Item.collection_id == Collection.id)
        .join(User, Collection.owner_id == User.id)
    )

    if collection_id is not None:
        total_query = total_query.where(Item.collection_id == collection_id)
        items_query = items_query.where(Item.collection_id == collection_id)

    if search_term:
        pattern = f"%{search_term}%"
        search_clause = or_(
            Item.name.ilike(pattern),
            Item.notes.ilike(pattern),
            Collection.name.ilike(pattern),
            User.email.ilike(pattern),
        )
        total_query = total_query.where(search_clause)
        items_query = items_query.where(search_clause)

    total_count = db.execute(total_query).scalar_one()
    rows = db.execute(
        items_query.order_by(Item.created_at.desc(), Item.id.desc()).offset(offset).limit(limit)
    ).all()
    items = [
        AdminItemResponse(
            id=item.id,
            collection_id=item.collection_id,
            collection_name=collection_name,
            owner_id=owner_id,
            owner_email=owner_email,
            name=item.name,
            notes=item.notes,
            is_featured=item.is_featured,
            is_highlight=item.is_highlight,
            image_count=int(image_count_value),
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item, collection_name, owner_id, owner_email, image_count_value in rows
    ]
    return AdminItemListResponse(total_count=total_count, items=items)


@router.delete("/items/{item_id}", response_model=MessageResponse)
def delete_admin_item(
    item_id: int,
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> MessageResponse:
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    db.delete(item)
    db.commit()
    return MessageResponse(message="Item deleted")


@router.post("/featured", response_model=MessageResponse)
def set_featured_collection(
    request: AdminFeatureRequest,
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> MessageResponse:
    _require_admin_config()
    if request.collection_id is None:
        db.execute(update(Collection).values(is_featured=False))
        db.execute(update(Item).values(is_featured=False))
        db.commit()
        return MessageResponse(message="Featured collection cleared")

    collection = db.get(Collection, request.collection_id)
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")

    if not collection.is_public:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Only public collections can be featured",
        )

    db.execute(update(Collection).values(is_featured=False))
    db.execute(update(Item).values(is_featured=False))
    collection.is_featured = True
    db.add(collection)
    featured_items = (
        db.execute(
            select(Item)
            .where(
                Item.collection_id == collection.id,
                Item.is_draft.is_(False),
            )
            .order_by(Item.created_at.desc(), Item.id.desc())
            .limit(4)
        )
        .scalars()
        .all()
    )
    for item in featured_items:
        item.is_featured = True
        db.add(item)
    db.commit()
    return MessageResponse(message="Featured collection updated")


@router.get("/featured/items", response_model=list[AdminFeaturedItemResponse])
def list_featured_items(
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> list[AdminFeaturedItemResponse]:
    collection_id = db.execute(
        select(Collection.id).where(Collection.is_featured.is_(True))
    ).scalar_one_or_none()
    if not collection_id:
        return []

    primary_image_id = _primary_image_id_subquery().label("primary_image_id")
    rows = db.execute(
        select(Item, primary_image_id)
        .where(
            Item.collection_id == collection_id,
            Item.is_draft.is_(False),
        )
        .order_by(Item.created_at.desc(), Item.id.desc())
    ).all()
    items: list[Item] = []
    for item, image_id in rows:
        setattr(item, "primary_image_id", image_id)
        items.append(item)
    return items


@router.post("/featured/items", response_model=MessageResponse)
def set_featured_items(
    request: AdminFeaturedItemsRequest,
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> MessageResponse:
    _require_admin_config()
    collection_id = db.execute(
        select(Collection.id).where(Collection.is_featured.is_(True))
    ).scalar_one_or_none()
    if not collection_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Select a featured collection before choosing items",
        )

    if request.item_ids:
        valid_ids = (
            db.execute(
                select(Item.id).where(
                    Item.collection_id == collection_id,
                    Item.is_draft.is_(False),
                    Item.id.in_(request.item_ids),
                )
            )
            .scalars()
            .all()
        )
        if len(valid_ids) != len(request.item_ids):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or more items could not be found in the featured collection",
            )

    db.execute(update(Item).where(Item.collection_id == collection_id).values(is_featured=False))
    if request.item_ids:
        db.execute(update(Item).where(Item.id.in_(request.item_ids)).values(is_featured=True))
    db.commit()
    return MessageResponse(message="Featured items updated")

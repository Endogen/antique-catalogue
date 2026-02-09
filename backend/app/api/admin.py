from __future__ import annotations

import hmac
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.security import TokenError, create_admin_token, decode_token
from app.core.settings import settings
from app.db.session import get_db
from app.models.collection import Collection
from app.models.item import Item
from app.models.user import User
from app.schemas.admin import (
    AdminCollectionListResponse,
    AdminCollectionResponse,
    AdminFeatureRequest,
    AdminLoginRequest,
    AdminStatsResponse,
    AdminTokenResponse,
)
from app.schemas.responses import MessageResponse

router = APIRouter(prefix="/admin", tags=["admin"])


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
    featured_collection_id = (
        db.execute(select(Collection.id).where(Collection.is_featured.is_(True)))
        .scalar_one_or_none()
    )
    return AdminStatsResponse(
        total_users=total_users,
        total_collections=total_collections,
        featured_collection_id=featured_collection_id,
    )


@router.get("/collections", response_model=AdminCollectionListResponse)
def list_admin_collections(
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    _: str = Depends(get_admin_subject),
    db: Session = Depends(get_db),
) -> AdminCollectionListResponse:
    total_count = db.execute(select(func.count(Collection.id))).scalar_one()
    rows = (
        db.execute(
            select(Collection, User.email)
            .join(User, Collection.owner_id == User.id)
            .order_by(Collection.created_at.desc(), Collection.id.desc())
            .offset(offset)
            .limit(limit)
        )
        .all()
    )

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
            .where(Item.collection_id == collection.id)
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

from __future__ import annotations

from importlib.util import find_spec
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, func, select, union_all
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.settings import settings
from app.db.session import get_db
from app.models.collection import Collection
from app.models.collection_star import CollectionStar
from app.models.item import Item
from app.models.item_star import ItemStar
from app.models.user import User
from app.schemas.collections import CollectionResponse
from app.schemas.profiles import ProfileUpdateRequest, PublicProfileResponse
from app.schemas.responses import MessageResponse
from app.services.activity import log_activity
from app.services.image_processing import (
    ImageProcessingError,
    build_variant_filename,
    generate_image_variants,
    save_image_variants,
)
from app.services.usernames import normalize_username_lookup, validate_username_for_user

router = APIRouter(prefix="/profiles", tags=["profiles"])
avatar_router = APIRouter(prefix="/avatars", tags=["profiles"])

MAX_AVATAR_BYTES = 5 * 1024 * 1024
MULTIPART_AVAILABLE = find_spec("multipart") is not None


def _get_profile_user_or_404(db: Session, username: str) -> User:
    try:
        normalized_username = normalize_username_lookup(username)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    user = db.execute(select(User).where(User.username == normalized_username)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return user


def _earned_stars_leaderboard_subquery():
    collection_star_counts = (
        select(
            Collection.owner_id.label("user_id"),
            func.count(CollectionStar.id).label("star_count"),
        )
        .join(
            CollectionStar,
            and_(
                CollectionStar.collection_id == Collection.id,
                CollectionStar.user_id != Collection.owner_id,
            ),
        )
        .where(Collection.is_public.is_(True))
        .group_by(Collection.owner_id)
    )
    item_star_counts = (
        select(
            Collection.owner_id.label("user_id"),
            func.count(ItemStar.id).label("star_count"),
        )
        .join(Item, Item.collection_id == Collection.id)
        .join(
            ItemStar,
            and_(
                ItemStar.item_id == Item.id,
                ItemStar.user_id != Collection.owner_id,
            ),
        )
        .where(Collection.is_public.is_(True))
        .group_by(Collection.owner_id)
    )

    star_events = union_all(collection_star_counts, item_star_counts).subquery()
    return (
        select(
            User.id.label("user_id"),
            func.coalesce(func.sum(star_events.c.star_count), 0).label("earned_star_count"),
        )
        .outerjoin(star_events, star_events.c.user_id == User.id)
        .group_by(User.id)
        .subquery()
    )


def _build_public_profile_response(db: Session, user: User) -> PublicProfileResponse:
    public_collection_count = db.execute(
        select(func.count(Collection.id)).where(
            Collection.owner_id == user.id,
            Collection.is_public.is_(True),
        )
    ).scalar_one()
    public_item_count = db.execute(
        select(func.count(Item.id))
        .join(Collection, Item.collection_id == Collection.id)
        .where(
            Collection.owner_id == user.id,
            Collection.is_public.is_(True),
        )
    ).scalar_one()

    leaderboard = _earned_stars_leaderboard_subquery()
    ranked = select(
        leaderboard.c.user_id,
        leaderboard.c.earned_star_count,
        func.rank()
        .over(
            order_by=(
                leaderboard.c.earned_star_count.desc(),
                leaderboard.c.user_id.asc(),
            )
        )
        .label("star_rank"),
    ).subquery()
    rank_row = db.execute(
        select(ranked.c.earned_star_count, ranked.c.star_rank).where(ranked.c.user_id == user.id)
    ).one_or_none()
    earned_star_count = int(rank_row.earned_star_count) if rank_row else 0
    star_rank = int(rank_row.star_rank) if rank_row else 1

    return PublicProfileResponse(
        id=user.id,
        username=user.username,
        has_avatar=user.avatar_filename is not None,
        created_at=user.created_at,
        public_collection_count=public_collection_count,
        public_item_count=public_item_count,
        earned_star_count=earned_star_count,
        star_rank=star_rank,
    )


def _collection_item_counts_subquery():
    return (
        select(
            Item.collection_id,
            func.count(Item.id).label("item_count"),
        )
        .group_by(Item.collection_id)
        .subquery()
    )


def _collection_star_counts_subquery():
    return (
        select(
            CollectionStar.collection_id,
            func.count(CollectionStar.id).label("star_count"),
        )
        .group_by(CollectionStar.collection_id)
        .subquery()
    )


@router.get("/me", response_model=PublicProfileResponse)
def read_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PublicProfileResponse:
    return _build_public_profile_response(db, current_user)


@router.patch("/me", response_model=PublicProfileResponse)
def update_my_profile(
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PublicProfileResponse:
    try:
        next_username = validate_username_for_user(request.username, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    if current_user.username != next_username:
        current_user.username = next_username
        db.add(current_user)
        try:
            log_activity(
                db,
                user_id=current_user.id,
                action_type="profile.username_updated",
                resource_type="user",
                resource_id=current_user.id,
                summary=f'Updated username to "{current_user.username}".',
            )
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
            )
        db.refresh(current_user)

    return _build_public_profile_response(db, current_user)


@router.get("/{username}/collections", response_model=list[CollectionResponse])
def list_public_profile_collections(
    username: str,
    db: Session = Depends(get_db),
) -> list[CollectionResponse]:
    user = _get_profile_user_or_404(db, username)

    item_counts = _collection_item_counts_subquery()
    star_counts = _collection_star_counts_subquery()
    rows = db.execute(
        select(
            Collection,
            func.coalesce(item_counts.c.item_count, 0),
            func.coalesce(star_counts.c.star_count, 0),
        )
        .outerjoin(item_counts, item_counts.c.collection_id == Collection.id)
        .outerjoin(star_counts, star_counts.c.collection_id == Collection.id)
        .where(Collection.owner_id == user.id, Collection.is_public.is_(True))
        .order_by(Collection.created_at.desc(), Collection.id.desc())
    ).all()

    collections: list[Collection] = []
    for collection, item_count, star_count in rows:
        setattr(collection, "item_count", item_count)
        setattr(collection, "star_count", star_count)
        setattr(collection, "owner_username", user.username)
        collections.append(collection)
    return collections


@router.get("/{username}", response_model=PublicProfileResponse)
def read_public_profile(username: str, db: Session = Depends(get_db)) -> PublicProfileResponse:
    user = _get_profile_user_or_404(db, username)
    return _build_public_profile_response(db, user)


# ---------------------------------------------------------------------------
# Avatar upload / delete / serve
# ---------------------------------------------------------------------------


def _avatar_dir(user_id: int) -> Path:
    return settings.uploads_dir / "avatars" / str(user_id)


def _cleanup_avatar_files(user_id: int) -> None:
    directory = _avatar_dir(user_id)
    if not directory.exists():
        return
    for path in directory.glob("avatar_*.jpg"):
        path.unlink(missing_ok=True)


def _read_avatar_upload(file: UploadFile) -> bytes:
    data = file.file.read(MAX_AVATAR_BYTES + 1)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Image file is empty",
        )
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Avatar image exceeds 5MB limit",
        )
    return data


if MULTIPART_AVAILABLE:

    @router.post("/me/avatar", response_model=PublicProfileResponse)
    def upload_avatar(
        file: UploadFile = File(..., description="Avatar image file"),
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> PublicProfileResponse:
        try:
            payload = _read_avatar_upload(file)

            try:
                variants = generate_image_variants(payload)
            except ImageProcessingError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=str(exc),
                ) from exc

            # Clean up any previous avatar files
            _cleanup_avatar_files(current_user.id)

            output_dir = _avatar_dir(current_user.id)
            try:
                save_image_variants(variants.as_dict(), output_dir, "avatar")
            except Exception as exc:
                _cleanup_avatar_files(current_user.id)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to store avatar",
                ) from exc

            filename = file.filename or "avatar.jpg"
            current_user.avatar_filename = Path(filename).name
            db.add(current_user)
            log_activity(
                db,
                user_id=current_user.id,
                action_type="profile.avatar_updated",
                resource_type="user",
                resource_id=current_user.id,
                summary="Updated profile avatar.",
            )
            db.commit()
            db.refresh(current_user)

            return _build_public_profile_response(db, current_user)
        finally:
            file.file.close()


@router.delete("/me/avatar", response_model=MessageResponse)
def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if not current_user.avatar_filename:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No avatar to remove",
        )

    _cleanup_avatar_files(current_user.id)
    current_user.avatar_filename = None
    db.add(current_user)
    log_activity(
        db,
        user_id=current_user.id,
        action_type="profile.avatar_removed",
        resource_type="user",
        resource_id=current_user.id,
        summary="Removed profile avatar.",
    )
    db.commit()
    return MessageResponse(message="Avatar removed")


@avatar_router.get("/{user_id}/{variant}.jpg")
def serve_avatar(user_id: int, variant: str) -> FileResponse:
    try:
        filename = build_variant_filename("avatar", variant)
    except ImageProcessingError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    path = _avatar_dir(user_id) / filename
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    return FileResponse(path, media_type="image/jpeg", filename=filename)

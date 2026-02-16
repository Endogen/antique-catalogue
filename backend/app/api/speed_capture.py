"""Speed Capture API — fast photo-first item creation for mobile."""

from __future__ import annotations

from importlib.util import find_spec
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.settings import settings
from app.db.session import get_db
from app.models.collection import Collection
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.user import User
from app.schemas.speed_capture import (
    SpeedCaptureAddResponse,
    SpeedCaptureNewResponse,
    SpeedCaptureSessionResponse,
)
from app.services.activity import log_activity
from app.services.image_processing import (
    ImageProcessingError,
    generate_image_variants,
    save_image_variants,
)

router = APIRouter(prefix="/speed-capture", tags=["speed-capture"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MULTIPART_AVAILABLE = find_spec("multipart") is not None


def _get_own_collection_or_404(db: Session, collection_id: int, owner_id: int) -> Collection:
    collection = (
        db.execute(
            select(Collection).where(
                Collection.id == collection_id,
                Collection.owner_id == owner_id,
            )
        )
        .scalars()
        .first()
    )
    if not collection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return collection


def _get_own_draft_or_404(db: Session, item_id: int, owner_id: int) -> Item:
    item = (
        db.execute(
            select(Item)
            .join(Collection, Item.collection_id == Collection.id)
            .where(
                Item.id == item_id,
                Item.is_draft.is_(True),
                Collection.owner_id == owner_id,
            )
        )
        .scalars()
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft item not found")
    return item


def _next_draft_number(db: Session, collection_id: int) -> int:
    count = db.execute(
        select(func.count(Item.id)).where(
            Item.collection_id == collection_id,
            Item.is_draft.is_(True),
        )
    ).scalar_one()
    return count + 1


def _next_image_position(db: Session, item_id: int) -> int:
    current = db.execute(
        select(func.max(ItemImage.position)).where(ItemImage.item_id == item_id)
    ).scalar_one_or_none()
    if current is None:
        return 0
    return int(current) + 1


def _build_upload_dir(user_id: int, collection_id: int, item_id: int) -> Path:
    return settings.uploads_dir / str(user_id) / str(collection_id) / str(item_id)


def _read_upload(file: UploadFile) -> bytes:
    data = file.file.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Image file is empty",
        )
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds 10MB limit",
        )
    return data


def _cleanup_variants(output_dir: Path, image_id: int) -> None:
    if not output_dir.exists():
        return
    for path in output_dir.glob(f"{image_id}_*.jpg"):
        path.unlink(missing_ok=True)


def _process_and_save_image(
    payload: bytes,
    output_dir: Path,
    image_id: int,
    db: Session,
) -> None:
    try:
        variants = generate_image_variants(payload)
    except ImageProcessingError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    try:
        save_image_variants(variants.as_dict(), output_dir, image_id)
    except Exception as exc:
        db.rollback()
        _cleanup_variants(output_dir, image_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store image",
        ) from exc


if MULTIPART_AVAILABLE:

    @router.post(
        "/{collection_id}/new",
        response_model=SpeedCaptureNewResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def capture_new_item(
        collection_id: int,
        file: UploadFile = File(..., description="Image file"),
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> SpeedCaptureNewResponse:
        """Create a new draft item and upload its first image."""
        filename = (file.filename or "").strip()
        if not filename:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Image filename is required",
            )
        safe_filename = Path(filename).name

        try:
            payload = _read_upload(file)
            collection = _get_own_collection_or_404(db, collection_id, current_user.id)
            draft_number = _next_draft_number(db, collection_id)

            item = Item(
                collection_id=collection_id,
                name=f"Draft {draft_number}",
                is_draft=True,
            )
            db.add(item)
            db.flush()

            image = ItemImage(item_id=item.id, filename=safe_filename, position=0)
            db.add(image)
            db.flush()

            output_dir = _build_upload_dir(current_user.id, collection_id, item.id)
            _process_and_save_image(payload, output_dir, image.id, db)

            log_activity(
                db,
                user_id=current_user.id,
                action_type="item.created",
                resource_type="item",
                resource_id=item.id,
                summary=f'Speed capture: created draft in "{collection.name}".',
            )
            db.commit()
            db.refresh(item)
            db.refresh(image)

            return SpeedCaptureNewResponse(
                item_id=item.id,
                item_name=item.name,
                image_id=image.id,
                image_count=1,
                collection_id=collection_id,
            )
        finally:
            file.file.close()

    @router.post(
        "/{collection_id}/items/{item_id}/add",
        response_model=SpeedCaptureAddResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def capture_add_image(
        collection_id: int,
        item_id: int,
        file: UploadFile = File(..., description="Image file"),
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> SpeedCaptureAddResponse:
        """Add another image to an existing draft item."""
        filename = (file.filename or "").strip()
        if not filename:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Image filename is required",
            )
        safe_filename = Path(filename).name

        try:
            payload = _read_upload(file)
            _get_own_collection_or_404(db, collection_id, current_user.id)
            item = _get_own_draft_or_404(db, item_id, current_user.id)

            if item.collection_id != collection_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Draft item not found",
                )

            position = _next_image_position(db, item.id)
            image = ItemImage(item_id=item.id, filename=safe_filename, position=position)
            db.add(image)
            db.flush()

            output_dir = _build_upload_dir(current_user.id, collection_id, item.id)
            _process_and_save_image(payload, output_dir, image.id, db)

            total_images = db.execute(
                select(func.count(ItemImage.id)).where(ItemImage.item_id == item.id)
            ).scalar_one()

            db.commit()
            db.refresh(image)

            return SpeedCaptureAddResponse(
                item_id=item.id,
                image_id=image.id,
                image_count=total_images,
            )
        finally:
            file.file.close()

else:  # pragma: no cover

    @router.post("/{collection_id}/new", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
    def capture_new_item_unavailable(collection_id: int) -> dict:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speed capture requires python-multipart",
        )

    @router.post(
        "/{collection_id}/items/{item_id}/add",
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    )
    def capture_add_image_unavailable(collection_id: int, item_id: int) -> dict:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Speed capture requires python-multipart",
        )


@router.get("/{collection_id}/session", response_model=SpeedCaptureSessionResponse)
def get_capture_session(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SpeedCaptureSessionResponse:
    """Get the current speed capture session state for a collection."""
    collection = _get_own_collection_or_404(db, collection_id, current_user.id)

    draft_count = db.execute(
        select(func.count(Item.id)).where(
            Item.collection_id == collection_id,
            Item.is_draft.is_(True),
        )
    ).scalar_one()

    total_images = db.execute(
        select(func.count(ItemImage.id))
        .join(Item, ItemImage.item_id == Item.id)
        .where(
            Item.collection_id == collection_id,
            Item.is_draft.is_(True),
        )
    ).scalar_one()

    return SpeedCaptureSessionResponse(
        collection_id=collection_id,
        collection_name=collection.name,
        draft_count=draft_count,
        total_images=total_images,
    )

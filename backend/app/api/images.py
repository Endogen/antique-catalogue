from __future__ import annotations

from importlib.util import find_spec
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_user
from app.core.settings import settings
from app.db.session import get_db
from app.models.collection import Collection
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.user import User
from app.schemas.images import ItemImageResponse, ItemImageUpdateRequest
from app.schemas.responses import MessageResponse
from app.services.image_processing import (
    ImageProcessingError,
    build_variant_filename,
    generate_image_variants,
    save_image_variants,
)

router = APIRouter(prefix="/items/{item_id}/images", tags=["images"])
serve_router = APIRouter(prefix="/images", tags=["images"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MULTIPART_AVAILABLE = find_spec("multipart") is not None


def _get_item_or_404(db: Session, item_id: int, owner_id: int) -> Item:
    item = (
        db.execute(
            select(Item)
            .join(Collection, Item.collection_id == Collection.id)
            .where(Item.id == item_id, Collection.owner_id == owner_id)
        )
        .scalars()
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


def _get_item_with_collection(db: Session, item_id: int) -> tuple[Item, Collection]:
    result = db.execute(
        select(Item, Collection)
        .join(Collection, Item.collection_id == Collection.id)
        .where(Item.id == item_id)
    ).first()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    item, collection = result
    return item, collection


def _require_item_access(collection: Collection, user: User | None) -> None:
    if collection.is_public:
        return
    if user is None or collection.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")


def _get_image_or_404(db: Session, item_id: int, image_id: int, owner_id: int) -> ItemImage:
    image = (
        db.execute(
            select(ItemImage)
            .join(Item, ItemImage.item_id == Item.id)
            .join(Collection, Item.collection_id == Collection.id)
            .where(
                ItemImage.id == image_id,
                ItemImage.item_id == item_id,
                Collection.owner_id == owner_id,
            )
        )
        .scalars()
        .first()
    )
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return image


def _get_image_with_context(db: Session, image_id: int) -> tuple[ItemImage, Item, Collection]:
    result = db.execute(
        select(ItemImage, Item, Collection)
        .join(Item, ItemImage.item_id == Item.id)
        .join(Collection, Item.collection_id == Collection.id)
        .where(ItemImage.id == image_id)
    ).first()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    image, item, collection = result
    return image, item, collection


def _get_next_position(db: Session, item_id: int) -> int:
    current = db.execute(
        select(func.max(ItemImage.position)).where(ItemImage.item_id == item_id)
    ).scalar_one_or_none()
    if current is None:
        return 0
    return int(current) + 1


def _build_upload_dir(user_id: int, collection_id: int, item_id: int) -> Path:
    return settings.uploads_dir / str(user_id) / str(collection_id) / str(item_id)


def _cleanup_variants(output_dir: Path, image_id: int) -> None:
    if not output_dir.exists():
        return
    pattern = f"{image_id}_*.jpg"
    for path in output_dir.glob(pattern):
        path.unlink(missing_ok=True)


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


def _resequence_positions(images: list[ItemImage]) -> None:
    for position, image in enumerate(images):
        image.position = position


if MULTIPART_AVAILABLE:

    @router.post("", response_model=ItemImageResponse, status_code=status.HTTP_201_CREATED)
    @router.post(
        "/",
        response_model=ItemImageResponse,
        status_code=status.HTTP_201_CREATED,
        include_in_schema=False,
    )
    def upload_image(
        item_id: int,
        file: UploadFile = File(..., description="Image file"),
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> ItemImageResponse:
        filename = (file.filename or "").strip()
        if not filename:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Image filename is required",
            )
        safe_filename = Path(filename).name

        try:
            payload = _read_upload(file)
            item = _get_item_or_404(db, item_id, current_user.id)
            position = _get_next_position(db, item.id)

            image = ItemImage(item_id=item.id, filename=safe_filename, position=position)
            db.add(image)
            db.flush()

            output_dir = _build_upload_dir(current_user.id, item.collection_id, item.id)
            try:
                variants = generate_image_variants(payload)
            except ImageProcessingError as exc:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=str(exc),
                ) from exc

            try:
                save_image_variants(variants.as_dict(), output_dir, image.id)
            except Exception as exc:
                db.rollback()
                _cleanup_variants(output_dir, image.id)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to store image",
                ) from exc

            db.commit()
            db.refresh(image)
            return image
        finally:
            file.file.close()
else:

    @router.post(
        "",
        response_model=MessageResponse,
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    )
    @router.post(
        "/",
        response_model=MessageResponse,
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        include_in_schema=False,
    )
    def upload_image_unavailable(
        item_id: int,
        current_user: User = Depends(get_current_user),
    ) -> MessageResponse:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload requires python-multipart",
        )


@router.get("", response_model=list[ItemImageResponse])
@router.get("/", response_model=list[ItemImageResponse], include_in_schema=False)
def list_images(
    item_id: int,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> list[ItemImageResponse]:
    item, collection = _get_item_with_collection(db, item_id)
    _require_item_access(collection, current_user)
    images = (
        db.execute(
            select(ItemImage)
            .where(ItemImage.item_id == item.id)
            .order_by(ItemImage.position.asc(), ItemImage.id.asc())
        )
        .scalars()
        .all()
    )
    return images


@router.patch("/{image_id}", response_model=ItemImageResponse)
def reorder_image(
    item_id: int,
    image_id: int,
    request: ItemImageUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemImageResponse:
    _get_item_or_404(db, item_id, current_user.id)
    image = _get_image_or_404(db, item_id, image_id, current_user.id)

    images = (
        db.execute(
            select(ItemImage)
            .where(ItemImage.item_id == item_id)
            .order_by(ItemImage.position.asc(), ItemImage.id.asc())
        )
        .scalars()
        .all()
    )
    if not images:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    max_position = len(images) - 1
    if request.position > max_position:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Position out of range",
        )

    ordered = [img for img in images if img.id != image.id]
    ordered.insert(request.position, image)
    _resequence_positions(ordered)

    db.commit()
    db.refresh(image)
    return image


@router.delete("/{image_id}", response_model=MessageResponse)
def delete_image(
    item_id: int,
    image_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    item = _get_item_or_404(db, item_id, current_user.id)
    image = _get_image_or_404(db, item_id, image_id, current_user.id)

    output_dir = _build_upload_dir(current_user.id, item.collection_id, item.id)
    _cleanup_variants(output_dir, image.id)

    db.delete(image)
    db.commit()
    return MessageResponse(message="Image deleted")


@serve_router.get("/{image_id}/{variant}.jpg")
def serve_image(
    image_id: int,
    variant: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    image, item, collection = _get_image_with_context(db, image_id)
    _require_item_access(collection, current_user)

    try:
        filename = build_variant_filename(image.id, variant)
    except ImageProcessingError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    output_dir = _build_upload_dir(collection.owner_id, collection.id, item.id)
    path = output_dir / filename
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return FileResponse(path, media_type="image/jpeg", filename=filename)

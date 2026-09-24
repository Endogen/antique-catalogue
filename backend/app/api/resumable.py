"""Bounded chunk transfers; completion and its receipt commit together."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session
from starlette.requests import ClientDisconnect

from app.api.deps import get_current_user
from app.api.images import _cleanup_variants, _get_item_or_404, _get_next_position
from app.api.speed_capture import _get_own_collection_or_404, _next_draft_number
from app.core.settings import get_settings
from app.db.session import get_db
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.transfer import UploadSession
from app.models.user import User
from app.schemas.images import ItemImageResponse
from app.services.activity import log_activity
from app.services.image_processing import (
    ImageProcessingError,
    generate_image_variants,
    save_image_variants,
)
from app.services.uploads import item_upload_dir

router = APIRouter(prefix="/uploads", tags=["resumable uploads"])
CHUNK_SIZE = 1024 * 1024


class Target(BaseModel):
    mode: Literal["item", "capture-new", "capture-add"]
    collection_id: int | None = None
    item_id: int | None = None

    @model_validator(mode="after")
    def validate_target(self):
        if self.mode != "item" and not self.collection_id:
            raise ValueError("Collection required")
        if self.mode != "capture-new" and not self.item_id:
            raise ValueError("Item required")
        return self


class Start(BaseModel):
    id: UUID
    target: Target
    filename: str = Field(min_length=1, max_length=255)
    size: int = Field(gt=0)

    @field_validator("size")
    @classmethod
    def _within_configured_limit(cls, value: int) -> int:
        # Read at validation time, not class definition, so the deployed
        # MAX_IMAGE_BYTES applies here as well as to direct uploads.
        max_bytes = get_settings().max_image_bytes
        if value > max_bytes:
            raise ValueError(f"Image exceeds the {max_bytes // (1024 * 1024)}MB limit")
        return value


def target_item(db, target, user):
    if target["mode"] == "capture-new":
        _get_own_collection_or_404(db, target["collection_id"], user.id)
        return None
    item = _get_item_or_404(db, target["item_id"], user.id)
    if target["mode"] == "capture-add" and (
        not item.is_draft or item.collection_id != target["collection_id"]
    ):
        raise HTTPException(409, "The capture draft has moved or been published.")
    return item


def own(db, upload_id, user):
    session = db.get(UploadSession, str(upload_id))
    if not session or session.owner_id != user.id:
        raise HTTPException(404, "Upload not found")
    return session


def status(session):
    return {
        "id": session.id,
        "received": session.received,
        "size": session.size,
        "chunk_size": CHUNK_SIZE,
        "result": session.result,
    }


@router.post("")
def start(payload: Start, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Expired incomplete uploads release storage; completed receipts remain idempotent.
    db.execute(
        delete(UploadSession).where(
            UploadSession.created_at < datetime.now(timezone.utc) - timedelta(days=7),
            or_(UploadSession.received < UploadSession.size, UploadSession.data != b""),
        )
    )
    existing = db.get(UploadSession, str(payload.id))
    if existing:
        if existing.owner_id != user.id:
            raise HTTPException(404, "Upload not found")
        if (
            existing.target != payload.target.model_dump()
            or existing.size != payload.size
            or existing.filename != payload.filename
        ):
            raise HTTPException(409, "Upload identifier already used")
        db.commit()
        return status(existing)
    target_item(db, payload.target.model_dump(), user)
    count = db.scalar(
        select(func.count())
        .select_from(UploadSession)
        .where(
            UploadSession.owner_id == user.id,
            or_(UploadSession.received < UploadSession.size, UploadSession.data != b""),
        )
    )
    if count >= 20:
        raise HTTPException(429, "Finish or discard pending uploads first.")
    session = UploadSession(
        id=str(payload.id),
        owner_id=user.id,
        target=payload.target.model_dump(),
        filename=payload.filename,
        size=payload.size,
    )
    db.add(session)
    db.commit()
    return status(session)


@router.get("/{upload_id}")
def read(upload_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return status(own(db, upload_id, user))


@router.put("/{upload_id}")
async def chunk(
    upload_id: UUID,
    offset: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = bytearray()
    try:
        async for part in request.stream():
            data.extend(part)
            if len(data) > CHUNK_SIZE:
                raise HTTPException(413, "Chunk exceeds 1MB")
    except ClientDisconnect as exc:
        # Nothing is persisted until the whole chunk arrives. A reload or lost
        # connection is an expected resumable-transfer event, not a server error.
        raise HTTPException(400, "Upload interrupted. Resume this photo.") from exc
    session = own(db, upload_id, user)
    if session.result is not None:
        return status(session)
    if not data or offset < 0 or offset + len(data) > session.size:
        raise HTTPException(422, "Invalid chunk size or offset")
    if offset < session.received and session.data[offset : offset + len(data)] == data:
        return status(session)
    if offset != session.received:
        raise HTTPException(409, "Upload offset changed; request current status and resume.")
    changed = db.execute(
        update(UploadSession)
        .where(
            UploadSession.id == session.id,
            UploadSession.received == offset,
        )
        .values(data=session.data + bytes(data), received=offset + len(data))
    )
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Upload offset changed; request current status and resume.")
    db.commit()
    db.refresh(session)
    return status(session)


@router.post("/{upload_id}/complete")
def complete(
    upload_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    session = own(db, upload_id, user)
    # Serialize finalizers (including different workers) before inspecting the receipt.
    db.execute(
        update(UploadSession)
        .where(UploadSession.id == session.id)
        .values(received=UploadSession.received)
    )
    db.refresh(session)
    if session.result is not None:
        return status(session)
    if session.received != session.size:
        raise HTTPException(409, "Upload is incomplete")
    item = target_item(db, session.target, user)
    try:
        variants = generate_image_variants(session.data)
    except ImageProcessingError as exc:
        raise HTTPException(422, str(exc)) from exc
    if item is None:
        cid = session.target["collection_id"]
        collection = _get_own_collection_or_404(db, cid, user.id)
        item = Item(collection_id=cid, name=f"Draft {_next_draft_number(db, cid)}", is_draft=True)
        db.add(item)
        db.flush()
        log_activity(
            db,
            user_id=user.id,
            action_type="item.created",
            resource_type="item",
            resource_id=item.id,
            summary=f'Speed capture: created draft in "{collection.name}".',
            context={
                "item_name": item.name,
                "collection_name": collection.name,
                "via": "speed_capture",
            },
        )
    image = ItemImage(
        item_id=item.id,
        filename=Path(session.filename).name,
        position=_get_next_position(db, item.id),
    )
    db.add(image)
    db.flush()
    output = item_upload_dir(user.id, item.collection_id, item.id)
    image_id = image.id
    try:
        save_image_variants(variants.as_dict(), output, image.id)
        result = ItemImageResponse.model_validate(image).model_dump(mode="json")
        result.update(
            mode=session.target["mode"],
            item_id=item.id,
            item_name=item.name,
            image_id=image.id,
            collection_id=item.collection_id,
            image_count=db.scalar(
                select(func.count(ItemImage.id)).where(ItemImage.item_id == item.id)
            ),
        )
        session.result = result
        session.data = b""
        db.commit()
    except Exception:
        _cleanup_variants(output, image_id)
        db.rollback()
        raise
    return status(session)


@router.delete("/{upload_id}")
def discard(upload_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = own(db, upload_id, user)
    # Recheck after acquiring the same write lock as completion. A stale discard
    # must never remove a completion receipt and permit duplicate finalization.
    db.execute(
        update(UploadSession)
        .where(UploadSession.id == session.id)
        .values(received=UploadSession.received)
    )
    db.refresh(session)
    if session.result is not None:
        raise HTTPException(
            409, "Upload already completed; delete its photo from the item instead."
        )
    db.delete(session)
    db.commit()
    return {"message": "Upload discarded"}

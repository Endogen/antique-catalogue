"""Versioned owner backups. Archives are validated without extracting ZIP paths."""

import hashlib
import json
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Literal
from uuid import UUID
from zipfile import ZIP_DEFLATED, BadZipFile, ZipFile

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from app.api.deps import get_current_user
from app.api.speed_capture import _get_own_collection_or_404
from app.db.session import get_db
from app.models.collection import Collection
from app.models.field_definition import FieldDefinition
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.transfer import ArchiveRestore
from app.models.user import User
from app.schemas.fields import FieldDefinitionCreateRequest
from app.services.activity import log_activity
from app.services.image_processing import (
    ImageProcessingError,
    generate_image_variants,
    save_image_variants,
    validate_image,
)
from app.services.metadata import require_finite_json
from app.services.metadata_preservation import preserve_values
from app.services.uploads import collection_upload_dir, item_upload_dir

router = APIRouter(tags=["collection archives"])
MAX_ARCHIVE = 250 * 1024 * 1024
MAX_MANIFEST = 10 * 1024 * 1024


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Photo(Record):
    path: str = Field(pattern=r"^photos/[0-9]+/[0-9]+\.jpg$")
    filename: str = Field(min_length=1, max_length=255)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    created_at: datetime


class ArchiveItem(Record):
    # Backups preserve names accepted by older versions without truncation.
    name: str = Field(min_length=1)
    notes: str | None = None
    metadata: dict | None = None
    preserved_metadata: list[dict] = Field(default_factory=list)
    is_draft: bool
    is_highlight: bool
    created_at: datetime
    updated_at: datetime
    photos: list[Photo] = Field(max_length=1000)

    @field_validator("metadata", "preserved_metadata")
    @classmethod
    def validate_numbers(cls, value):
        return require_finite_json(value)


class ArchiveCollection(Record):
    # Backups preserve names accepted by older versions without truncation.
    name: str = Field(min_length=1)
    description: str | None = None
    is_public: bool
    created_at: datetime
    updated_at: datetime


class Archive(Record):
    format: Literal["antique-catalogue"]
    version: Literal[1]
    collection: ArchiveCollection
    fields: list[FieldDefinitionCreateRequest] = Field(max_length=500)
    items: list[ArchiveItem] = Field(max_length=10000)


def stamp(value):
    return value.isoformat()


@router.get("/collections/{collection_id}/export")
def export(
    collection_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    collection = _get_own_collection_or_404(db, collection_id, user.id)
    fields = db.scalars(
        select(FieldDefinition)
        .where(FieldDefinition.collection_id == collection_id)
        .order_by(FieldDefinition.position, FieldDefinition.id)
    ).all()
    items = db.scalars(
        select(Item).where(Item.collection_id == collection_id).order_by(Item.id)
    ).all()
    if len(items) > 10000 or len(fields) > 500:
        raise HTTPException(413, "Collection exceeds the archive item or field limit.")
    manifest = {
        "format": "antique-catalogue",
        "version": 1,
        "collection": {
            key: getattr(collection, key)
            for key in ("name", "description", "is_public", "created_at", "updated_at")
        },
        "fields": [
            {
                key: getattr(field, key)
                for key in ("name", "field_type", "is_required", "is_private", "options")
            }
            for field in fields
        ],
        "items": [],
    }
    output = tempfile.TemporaryFile()
    total = 0
    photo_count = 0
    try:
        with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
            for index, item in enumerate(items):
                record = {
                    key: getattr(item, key)
                    for key in (
                        "name",
                        "notes",
                        "preserved_metadata",
                        "is_draft",
                        "is_highlight",
                        "created_at",
                        "updated_at",
                    )
                }
                record.update(metadata=item.metadata_, photos=[])
                images = db.scalars(
                    select(ItemImage)
                    .where(ItemImage.item_id == item.id)
                    .order_by(ItemImage.position, ItemImage.id)
                ).all()
                photo_count += len(images)
                if len(images) > 1000 or photo_count > 20000:
                    raise HTTPException(413, "Collection exceeds the archive photo limit.")
                for position, image in enumerate(images):
                    source = (
                        item_upload_dir(user.id, collection_id, item.id)
                        / f"{image.id}_original.jpg"
                    )
                    if not source.is_file():
                        raise HTTPException(409, "A photo is missing. Repair it before exporting.")
                    total += source.stat().st_size
                    if (
                        total > MAX_ARCHIVE - MAX_MANIFEST
                        or source.stat().st_size > 20 * 1024 * 1024
                    ):
                        raise HTTPException(413, "Collection exceeds the 250MB archive limit.")
                    payload = source.read_bytes()
                    name = f"photos/{index}/{position}.jpg"
                    archive.writestr(name, payload)
                    record["photos"].append(
                        {
                            "path": name,
                            "filename": image.filename,
                            "sha256": hashlib.sha256(payload).hexdigest(),
                            "created_at": image.created_at,
                        }
                    )
                manifest["items"].append(record)
            content = json.dumps(manifest, default=stamp, ensure_ascii=False).encode()
            if len(content) > MAX_MANIFEST:
                raise HTTPException(413, "Collection metadata exceeds the 10MB limit.")
            Archive.model_validate_json(content)
            archive.writestr("manifest.json", content)
        if output.tell() > MAX_ARCHIVE:
            raise HTTPException(413, "Collection exceeds the 250MB archive limit.")
        output.seek(0)
    except Exception:
        output.close()
        raise

    def stream():
        while chunk := output.read(1024 * 1024):
            yield chunk

    return StreamingResponse(
        stream(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="collection-{collection_id}.zip"',
            "Cache-Control": "no-store",
        },
        background=BackgroundTask(output.close),
    )


def inspect(file: UploadFile):
    file.file.seek(0, 2)
    if file.file.tell() > MAX_ARCHIVE:
        raise HTTPException(413, "Archive exceeds 250MB")
    file.file.seek(0)
    digest = hashlib.file_digest(file.file, "sha256").hexdigest()
    file.file.seek(0)
    try:
        with ZipFile(file.file) as zipfile:
            entries = zipfile.infolist()
            names = [entry.filename for entry in entries]
            if (
                len(names) > 20001
                or len(set(names)) != len(names)
                or sum(entry.file_size for entry in entries) > MAX_ARCHIVE
                or any(entry.flag_bits & 1 for entry in entries)
            ):
                raise ValueError("Archive contains duplicates, encryption, or too much data")
            if zipfile.getinfo("manifest.json").file_size > MAX_MANIFEST:
                raise ValueError("Manifest too large")
            manifest = Archive.model_validate_json(zipfile.read("manifest.json"))
            fields = [field.name for field in manifest.fields]
            if len(set(fields)) != len(fields):
                raise ValueError("Duplicate field names")
            expected = ["manifest.json"]
            for item in manifest.items:
                for entry in item.preserved_metadata:
                    if set(entry) != {"name", "value", "reason"} or not isinstance(
                        entry["name"], str
                    ):
                        raise ValueError("Invalid preserved metadata")
                for photo in item.photos:
                    expected.append(photo.path)
                    if zipfile.getinfo(photo.path).file_size > 20 * 1024 * 1024:
                        raise ValueError("Photo exceeds 20MB")
                    payload = zipfile.read(photo.path)
                    if hashlib.sha256(payload).hexdigest() != photo.sha256:
                        raise ValueError("Photo checksum mismatch")
                    validate_image(payload)
            if len(set(expected)) != len(expected) or set(names) != set(expected):
                raise ValueError("Unexpected or shared archive paths")
        return manifest, digest
    except (
        BadZipFile,
        KeyError,
        ValueError,
        ValidationError,
        ImageProcessingError,
        RuntimeError,
    ) as exc:
        raise HTTPException(422, "Invalid archive: " + str(exc)[:200]) from exc


@router.post("/archives/preview")
def preview(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    try:
        archive, digest = inspect(file)
        return {
            "name": archive.collection.name,
            "items": len(archive.items),
            "photos": sum(len(item.photos) for item in archive.items),
            "drafts": sum(item.is_draft for item in archive.items),
            "fields": [field.model_dump() for field in archive.fields],
            "private_fields": sum(field.is_private for field in archive.fields),
            "digest": digest,
        }
    finally:
        file.file.close()


@router.post("/archives/restore")
def restore(
    file: UploadFile = File(...),
    digest: str = Form(...),
    request_id: UUID = Form(...),
    name: str = Form(..., min_length=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    output: Path | None = None
    try:
        archive, actual_digest = inspect(file)
        if digest != actual_digest or not name.strip():
            raise HTTPException(409, "Archive changed since preview. Preview it again.")
        if len(name.strip()) > 200 and name.strip() != archive.collection.name:
            raise HTTPException(422, "New collection names must be at most 200 characters.")
        # A write reserves the key before restoring, serializing retries across workers.
        existing = db.get(ArchiveRestore, str(request_id))
        if existing:
            if existing.owner_id != user.id or existing.digest != digest:
                raise HTTPException(409, "Restore identifier already used")
            if existing.collection_id is None:
                raise HTTPException(410, "The restored collection has since been deleted.")
            return {"collection_id": existing.collection_id}
        receipt = ArchiveRestore(id=str(request_id), owner_id=user.id, digest=digest)
        db.add(receipt)
        db.flush()
        collection = Collection(
            owner_id=user.id,
            name=name.strip(),
            description=archive.collection.description,
            is_public=False,
            created_at=archive.collection.created_at,
            updated_at=archive.collection.updated_at,
        )
        db.add(collection)
        db.flush()
        output = collection_upload_dir(user.id, collection.id)
        for position, field in enumerate(archive.fields):
            db.add(
                FieldDefinition(
                    collection_id=collection.id, position=position, **field.model_dump()
                )
            )
        with ZipFile(file.file) as zipfile:
            for source in archive.items:
                item = Item(
                    collection_id=collection.id,
                    name=source.name,
                    notes=source.notes,
                    metadata_=source.metadata,
                    preserved_metadata=source.preserved_metadata,
                    is_draft=source.is_draft,
                    is_highlight=source.is_highlight,
                    created_at=source.created_at,
                    updated_at=source.updated_at,
                )
                known = {field.name for field in archive.fields}
                orphaned = {
                    key: value for key, value in (item.metadata_ or {}).items() if key not in known
                }
                if orphaned:
                    preserve_values(item, orphaned, "Unassigned archive field")
                    item.metadata_ = {
                        key: value for key, value in item.metadata_.items() if key in known
                    }
                db.add(item)
                db.flush()
                for position, photo in enumerate(source.photos):
                    image = ItemImage(
                        item_id=item.id,
                        filename=photo.filename,
                        position=position,
                        created_at=photo.created_at,
                    )
                    db.add(image)
                    db.flush()
                    variants = generate_image_variants(zipfile.read(photo.path)).as_dict()
                    # Keep the stored original byte-for-byte; only rebuild display variants.
                    variants["original"] = zipfile.read(photo.path)
                    save_image_variants(
                        variants, item_upload_dir(user.id, collection.id, item.id), image.id
                    )
        receipt.collection_id = collection.id
        log_activity(
            db,
            user_id=user.id,
            action_type="collection.created",
            resource_type="collection",
            resource_id=collection.id,
            summary=f'Restored collection "{collection.name}".',
            context={"collection_name": collection.name, "via": "restore"},
        )
        restored_id = collection.id
        db.commit()
        return {"collection_id": restored_id}
    except Exception:
        if output:
            shutil.rmtree(output, ignore_errors=True)
        db.rollback()
        raise
    finally:
        file.file.close()

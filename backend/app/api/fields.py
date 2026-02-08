from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.collection import Collection
from app.models.field_definition import FieldDefinition
from app.models.user import User
from app.schemas.fields import (
    FieldDefinitionCreateRequest,
    FieldDefinitionResponse,
    FieldDefinitionUpdateRequest,
)
from app.schemas.responses import MessageResponse

router = APIRouter(prefix="/collections/{collection_id}/fields", tags=["fields"])


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


def _get_field_or_404(
    db: Session, collection_id: int, field_id: int, owner_id: int
) -> FieldDefinition:
    field = (
        db.execute(
            select(FieldDefinition)
            .join(Collection, FieldDefinition.collection_id == Collection.id)
            .where(
                FieldDefinition.id == field_id,
                FieldDefinition.collection_id == collection_id,
                Collection.owner_id == owner_id,
            )
        )
        .scalars()
        .first()
    )
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")
    return field


@router.get("", response_model=list[FieldDefinitionResponse])
@router.get("/", response_model=list[FieldDefinitionResponse], include_in_schema=False)
def list_fields(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FieldDefinitionResponse]:
    _get_collection_or_404(db, collection_id, current_user.id)
    fields = (
        db.execute(
            select(FieldDefinition)
            .where(FieldDefinition.collection_id == collection_id)
            .order_by(FieldDefinition.position.asc(), FieldDefinition.id.asc())
        )
        .scalars()
        .all()
    )
    return fields


@router.post("", response_model=FieldDefinitionResponse, status_code=status.HTTP_201_CREATED)
@router.post(
    "/",
    response_model=FieldDefinitionResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_field(
    collection_id: int,
    request: FieldDefinitionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FieldDefinitionResponse:
    _get_collection_or_404(db, collection_id, current_user.id)

    existing = (
        db.execute(
            select(FieldDefinition.id).where(
                FieldDefinition.collection_id == collection_id,
                FieldDefinition.name == request.name,
            )
        )
        .scalars()
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Field name already exists"
        )

    max_position = db.execute(
        select(func.max(FieldDefinition.position)).where(
            FieldDefinition.collection_id == collection_id
        )
    ).scalar()
    position = (max_position or 0) + 1

    field = FieldDefinition(
        collection_id=collection_id,
        name=request.name,
        field_type=request.field_type,
        is_required=request.is_required,
        options=request.options,
        position=position,
    )
    db.add(field)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Field name already exists"
        )
    db.refresh(field)
    return field


@router.patch("/{field_id}", response_model=FieldDefinitionResponse)
def update_field(
    collection_id: int,
    field_id: int,
    request: FieldDefinitionUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FieldDefinitionResponse:
    field = _get_field_or_404(db, collection_id, field_id, current_user.id)
    data = request.model_dump(exclude_unset=True)

    if "name" in data and data["name"] != field.name:
        duplicate = (
            db.execute(
                select(FieldDefinition.id).where(
                    FieldDefinition.collection_id == collection_id,
                    FieldDefinition.name == data["name"],
                    FieldDefinition.id != field_id,
                )
            )
            .scalars()
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Field name already exists"
            )

    new_field_type = data.get("field_type", field.field_type)
    options_provided = "options" in data
    new_options = data.get("options", field.options)

    if new_field_type == "select":
        if new_options is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Select fields require options",
            )
    else:
        if options_provided and data["options"] is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Options are only allowed for select fields",
            )
        new_options = None

    if "name" in data:
        field.name = data["name"]
    if "field_type" in data:
        field.field_type = data["field_type"]
    if "is_required" in data:
        field.is_required = data["is_required"]

    field.options = new_options

    db.add(field)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Field name already exists"
        )
    db.refresh(field)
    return field


@router.delete("/{field_id}", response_model=MessageResponse)
def delete_field(
    collection_id: int,
    field_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    field = _get_field_or_404(db, collection_id, field_id, current_user.id)
    db.delete(field)
    db.commit()
    return MessageResponse(message="Field deleted")

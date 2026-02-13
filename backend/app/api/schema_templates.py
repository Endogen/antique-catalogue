from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.schema_template import SchemaTemplate
from app.models.schema_template_field import SchemaTemplateField
from app.models.user import User
from app.schemas.responses import MessageResponse
from app.schemas.schema_templates import (
    SchemaTemplateCopyRequest,
    SchemaTemplateCreateRequest,
    SchemaTemplateFieldCreateRequest,
    SchemaTemplateFieldReorderRequest,
    SchemaTemplateFieldResponse,
    SchemaTemplateFieldUpdateRequest,
    SchemaTemplateResponse,
    SchemaTemplateSummaryResponse,
    SchemaTemplateUpdateRequest,
)
from app.services.activity import log_activity

router = APIRouter(prefix="/schema-templates", tags=["schema templates"])


def _get_template_or_404(db: Session, template_id: int, owner_id: int) -> SchemaTemplate:
    template = (
        db.execute(
            select(SchemaTemplate).where(
                SchemaTemplate.id == template_id,
                SchemaTemplate.owner_id == owner_id,
            )
        )
        .scalars()
        .first()
    )
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schema template not found",
        )
    return template


def _get_template_field_or_404(
    db: Session,
    template_id: int,
    field_id: int,
    owner_id: int,
) -> SchemaTemplateField:
    field = (
        db.execute(
            select(SchemaTemplateField)
            .join(
                SchemaTemplate,
                SchemaTemplateField.schema_template_id == SchemaTemplate.id,
            )
            .where(
                SchemaTemplateField.id == field_id,
                SchemaTemplateField.schema_template_id == template_id,
                SchemaTemplate.owner_id == owner_id,
            )
        )
        .scalars()
        .first()
    )
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")
    return field


def _list_template_fields(db: Session, template_id: int) -> list[SchemaTemplateField]:
    return (
        db.execute(
            select(SchemaTemplateField)
            .where(SchemaTemplateField.schema_template_id == template_id)
            .order_by(SchemaTemplateField.position.asc(), SchemaTemplateField.id.asc())
        )
        .scalars()
        .all()
    )


def _build_template_response(
    template: SchemaTemplate,
    fields: list[SchemaTemplateField],
) -> SchemaTemplateResponse:
    return SchemaTemplateResponse(
        id=template.id,
        name=template.name,
        field_count=len(fields),
        fields=[SchemaTemplateFieldResponse.model_validate(field) for field in fields],
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


def _replace_template_fields(
    db: Session,
    *,
    template_id: int,
    fields: list[SchemaTemplateFieldCreateRequest],
) -> list[SchemaTemplateField]:
    db.execute(
        delete(SchemaTemplateField).where(SchemaTemplateField.schema_template_id == template_id)
    )

    created: list[SchemaTemplateField] = []
    for position, field in enumerate(fields, start=1):
        created.append(
            SchemaTemplateField(
                schema_template_id=template_id,
                name=field.name,
                field_type=field.field_type,
                is_required=field.is_required,
                is_private=field.is_private,
                options=field.options,
                position=position,
            )
        )
    if created:
        db.add_all(created)
    db.flush()
    return created


def _schema_template_name_exists(db: Session, *, owner_id: int, name: str) -> bool:
    existing = (
        db.execute(
            select(SchemaTemplate.id).where(
                SchemaTemplate.owner_id == owner_id,
                SchemaTemplate.name == name,
            )
        )
        .scalars()
        .first()
    )
    return existing is not None


def _build_unique_copy_name(db: Session, *, owner_id: int, source_name: str) -> str:
    base_name = f"{source_name} (Copy)"
    if not _schema_template_name_exists(db, owner_id=owner_id, name=base_name):
        return base_name

    copy_index = 2
    while True:
        candidate = f"{source_name} (Copy {copy_index})"
        if not _schema_template_name_exists(db, owner_id=owner_id, name=candidate):
            return candidate
        copy_index += 1


@router.get("", response_model=list[SchemaTemplateSummaryResponse])
@router.get("/", response_model=list[SchemaTemplateSummaryResponse], include_in_schema=False)
def list_schema_templates(
    q: str | None = Query(None, description="Search templates by name"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SchemaTemplateSummaryResponse]:
    field_counts = (
        select(
            SchemaTemplateField.schema_template_id,
            func.count(SchemaTemplateField.id).label("field_count"),
        )
        .group_by(SchemaTemplateField.schema_template_id)
        .subquery()
    )

    query = (
        select(
            SchemaTemplate,
            func.coalesce(field_counts.c.field_count, 0),
        )
        .outerjoin(field_counts, field_counts.c.schema_template_id == SchemaTemplate.id)
        .where(SchemaTemplate.owner_id == current_user.id)
    )

    term = q.strip() if q else ""
    if term:
        query = query.where(SchemaTemplate.name.ilike(f"%{term}%"))

    rows = db.execute(
        query.order_by(SchemaTemplate.updated_at.desc(), SchemaTemplate.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    return [
        SchemaTemplateSummaryResponse(
            id=template.id,
            name=template.name,
            field_count=field_count,
            created_at=template.created_at,
            updated_at=template.updated_at,
        )
        for template, field_count in rows
    ]


@router.post("", response_model=SchemaTemplateResponse, status_code=status.HTTP_201_CREATED)
@router.post(
    "/",
    response_model=SchemaTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_schema_template(
    request: SchemaTemplateCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SchemaTemplateResponse:
    existing = (
        db.execute(
            select(SchemaTemplate.id).where(
                SchemaTemplate.owner_id == current_user.id,
                SchemaTemplate.name == request.name,
            )
        )
        .scalars()
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Schema template name already exists",
        )

    template = SchemaTemplate(owner_id=current_user.id, name=request.name)
    db.add(template)
    db.flush()

    fields = _replace_template_fields(db, template_id=template.id, fields=request.fields)

    log_activity(
        db,
        user_id=current_user.id,
        action_type="schema_template.created",
        resource_type="schema_template",
        resource_id=template.id,
        summary=f'Created schema template "{template.name}".',
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Schema template name already exists",
        )

    db.refresh(template)
    return _build_template_response(template, fields)


@router.get("/{template_id}", response_model=SchemaTemplateResponse)
def get_schema_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SchemaTemplateResponse:
    template = _get_template_or_404(db, template_id, current_user.id)
    fields = _list_template_fields(db, template.id)
    return _build_template_response(template, fields)


@router.post(
    "/{template_id}/copy",
    response_model=SchemaTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def copy_schema_template(
    template_id: int,
    request: SchemaTemplateCopyRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SchemaTemplateResponse:
    source_template = _get_template_or_404(db, template_id, current_user.id)
    source_fields = _list_template_fields(db, source_template.id)
    payload = request or SchemaTemplateCopyRequest()

    if payload.name is not None:
        copy_name = payload.name
        if _schema_template_name_exists(db, owner_id=current_user.id, name=copy_name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Schema template name already exists",
            )
    else:
        copy_name = _build_unique_copy_name(
            db, owner_id=current_user.id, source_name=source_template.name
        )

    copied_template = SchemaTemplate(owner_id=current_user.id, name=copy_name)
    db.add(copied_template)
    db.flush()

    copied_fields: list[SchemaTemplateField] = []
    for position, field in enumerate(source_fields, start=1):
        copied_fields.append(
            SchemaTemplateField(
                schema_template_id=copied_template.id,
                name=field.name,
                field_type=field.field_type,
                is_required=field.is_required,
                is_private=field.is_private,
                options=field.options,
                position=position,
            )
        )
    if copied_fields:
        db.add_all(copied_fields)

    log_activity(
        db,
        user_id=current_user.id,
        action_type="schema_template.copied",
        resource_type="schema_template",
        resource_id=copied_template.id,
        summary=(f'Copied schema template "{source_template.name}" to "{copied_template.name}".'),
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Schema template name already exists",
        )

    db.refresh(copied_template)
    return _build_template_response(copied_template, copied_fields)


@router.patch("/{template_id}", response_model=SchemaTemplateResponse)
def update_schema_template(
    template_id: int,
    request: SchemaTemplateUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SchemaTemplateResponse:
    template = _get_template_or_404(db, template_id, current_user.id)
    fields_set = request.model_fields_set
    update_name = request.name
    update_fields = request.fields
    has_name_update = "name" in fields_set
    has_field_update = "fields" in fields_set

    if has_name_update and update_name is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Template name cannot be blank",
        )

    if has_name_update and update_name != template.name:
        duplicate = (
            db.execute(
                select(SchemaTemplate.id).where(
                    SchemaTemplate.owner_id == current_user.id,
                    SchemaTemplate.name == update_name,
                    SchemaTemplate.id != template.id,
                )
            )
            .scalars()
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Schema template name already exists",
            )
        template.name = update_name

    if has_field_update:
        _replace_template_fields(db, template_id=template.id, fields=update_fields or [])

    if has_name_update or has_field_update:
        template.updated_at = datetime.now(timezone.utc)
        log_activity(
            db,
            user_id=current_user.id,
            action_type="schema_template.updated",
            resource_type="schema_template",
            resource_id=template.id,
            summary=f'Updated schema template "{template.name}".',
        )

    db.add(template)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Schema template name already exists",
        )

    db.refresh(template)
    fields = _list_template_fields(db, template.id)
    return _build_template_response(template, fields)


@router.delete("/{template_id}", response_model=MessageResponse)
def delete_schema_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    template = _get_template_or_404(db, template_id, current_user.id)
    log_activity(
        db,
        user_id=current_user.id,
        action_type="schema_template.deleted",
        resource_type="schema_template",
        resource_id=template.id,
        summary=f'Deleted schema template "{template.name}".',
    )
    db.delete(template)
    db.commit()
    return MessageResponse(message="Schema template deleted")


@router.get("/{template_id}/fields", response_model=list[SchemaTemplateFieldResponse])
@router.get(
    "/{template_id}/fields/",
    response_model=list[SchemaTemplateFieldResponse],
    include_in_schema=False,
)
def list_schema_template_fields(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SchemaTemplateFieldResponse]:
    _get_template_or_404(db, template_id, current_user.id)
    return _list_template_fields(db, template_id)


@router.post(
    "/{template_id}/fields",
    response_model=SchemaTemplateFieldResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/{template_id}/fields/",
    response_model=SchemaTemplateFieldResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_schema_template_field(
    template_id: int,
    request: SchemaTemplateFieldCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SchemaTemplateFieldResponse:
    template = _get_template_or_404(db, template_id, current_user.id)

    existing = (
        db.execute(
            select(SchemaTemplateField.id).where(
                SchemaTemplateField.schema_template_id == template_id,
                SchemaTemplateField.name == request.name,
            )
        )
        .scalars()
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Field name already exists",
        )

    max_position = db.execute(
        select(func.max(SchemaTemplateField.position)).where(
            SchemaTemplateField.schema_template_id == template_id
        )
    ).scalar()
    position = (max_position or 0) + 1

    field = SchemaTemplateField(
        schema_template_id=template_id,
        name=request.name,
        field_type=request.field_type,
        is_required=request.is_required,
        is_private=request.is_private,
        options=request.options,
        position=position,
    )
    template.updated_at = datetime.now(timezone.utc)
    db.add(template)
    db.add(field)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Field name already exists",
        )
    db.refresh(field)
    return field


@router.patch(
    "/{template_id}/fields/reorder",
    response_model=list[SchemaTemplateFieldResponse],
)
def reorder_schema_template_fields(
    template_id: int,
    request: SchemaTemplateFieldReorderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SchemaTemplateFieldResponse]:
    template = _get_template_or_404(db, template_id, current_user.id)
    fields = (
        db.execute(
            select(SchemaTemplateField).where(SchemaTemplateField.schema_template_id == template_id)
        )
        .scalars()
        .all()
    )
    existing_ids = {field.id for field in fields}
    requested_ids = request.field_ids

    if len(requested_ids) != len(existing_ids) or set(requested_ids) != existing_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Field order must include all fields for the schema template",
        )

    field_by_id = {field.id: field for field in fields}
    for position, field_id in enumerate(requested_ids, start=1):
        field_by_id[field_id].position = position

    template.updated_at = datetime.now(timezone.utc)
    db.add(template)
    db.commit()
    return [field_by_id[field_id] for field_id in requested_ids]


@router.patch(
    "/{template_id}/fields/{field_id}",
    response_model=SchemaTemplateFieldResponse,
)
def update_schema_template_field(
    template_id: int,
    field_id: int,
    request: SchemaTemplateFieldUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SchemaTemplateFieldResponse:
    template = _get_template_or_404(db, template_id, current_user.id)
    field = _get_template_field_or_404(db, template_id, field_id, current_user.id)
    data = request.model_dump(exclude_unset=True)

    if "name" in data and data["name"] != field.name:
        duplicate = (
            db.execute(
                select(SchemaTemplateField.id).where(
                    SchemaTemplateField.schema_template_id == template_id,
                    SchemaTemplateField.name == data["name"],
                    SchemaTemplateField.id != field_id,
                )
            )
            .scalars()
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Field name already exists",
            )

    new_field_type = data.get("field_type", field.field_type)
    options_provided = "options" in data
    new_options = data.get("options", field.options)

    if new_field_type == "select":
        if new_options is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Select fields require options",
            )
    else:
        if options_provided and data["options"] is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Options are only allowed for select fields",
            )
        new_options = None

    if "name" in data:
        field.name = data["name"]
    if "field_type" in data:
        field.field_type = data["field_type"]
    if "is_required" in data:
        field.is_required = data["is_required"]
    if "is_private" in data:
        field.is_private = data["is_private"]

    field.options = new_options

    template.updated_at = datetime.now(timezone.utc)
    db.add(template)
    db.add(field)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Field name already exists",
        )
    db.refresh(field)
    return field


@router.delete("/{template_id}/fields/{field_id}", response_model=MessageResponse)
def delete_schema_template_field(
    template_id: int,
    field_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    template = _get_template_or_404(db, template_id, current_user.id)
    field = _get_template_field_or_404(db, template_id, field_id, current_user.id)
    template.updated_at = datetime.now(timezone.utc)
    db.add(template)
    db.delete(field)
    db.commit()
    return MessageResponse(message="Field deleted")

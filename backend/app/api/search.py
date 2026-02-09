from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.collection import Collection
from app.models.item import Item
from app.models.item_image import ItemImage
from app.models.user import User
from app.schemas.search import ItemSearchResponse

router = APIRouter(prefix="/search", tags=["search"])


def _primary_image_id_subquery():
    return (
        select(ItemImage.id)
        .where(ItemImage.item_id == Item.id)
        .order_by(ItemImage.position.asc(), ItemImage.id.asc())
        .limit(1)
        .scalar_subquery()
    )


@router.get("/items", response_model=list[ItemSearchResponse])
def search_items(
    q: str = Query(..., min_length=1, description="Search term for item name or notes"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int | None = Query(None, ge=1, le=1000, description="Optional pagination limit"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ItemSearchResponse]:
    term = q.strip()
    if not term:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Search term cannot be blank",
        )

    pattern = f"%{term}%"
    primary_image_id = _primary_image_id_subquery().label("primary_image_id")
    query = (
        select(Item, Collection.name, primary_image_id)
        .join(Collection, Item.collection_id == Collection.id)
        .where(
            Collection.owner_id == current_user.id,
            or_(Item.name.ilike(pattern), Item.notes.ilike(pattern)),
        )
        .order_by(Item.created_at.desc(), Item.id.desc())
        .offset(offset)
    )
    if limit is not None:
        query = query.limit(limit)
    rows = db.execute(query).all()

    results: list[ItemSearchResponse] = []
    for item, collection_name, image_id in rows:
        results.append(
            ItemSearchResponse(
                id=item.id,
                collection_id=item.collection_id,
                collection_name=collection_name,
                name=item.name,
                notes=item.notes,
                primary_image_id=image_id,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
        )
    return results

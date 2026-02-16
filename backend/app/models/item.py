from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.collection import Collection
    from app.models.item_image import ItemImage
    from app.models.item_star import ItemStar


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    collection_id: Mapped[int] = mapped_column(
        ForeignKey("collections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    metadata_: Mapped[dict[str, object] | None] = mapped_column("metadata", JSON, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text)
    is_featured: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    is_highlight: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    is_draft: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    collection: Mapped[Collection] = relationship(back_populates="items")
    images: Mapped[list[ItemImage]] = relationship(
        back_populates="item", cascade="all, delete-orphan", passive_deletes=True
    )
    stars: Mapped[list[ItemStar]] = relationship(
        back_populates="item", cascade="all, delete-orphan", passive_deletes=True
    )

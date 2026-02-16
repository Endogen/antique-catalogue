from __future__ import annotations

import secrets
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, false, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.collection import Collection
    from app.models.collection_star import CollectionStar
    from app.models.email_token import EmailToken
    from app.models.item_star import ItemStar
    from app.models.schema_template import SchemaTemplate


def _temporary_username() -> str:
    return f"u_{secrets.token_hex(5)}"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(
        String(12), unique=True, nullable=False, default=_temporary_username
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_filename: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    email_tokens: Mapped[list[EmailToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    collections: Mapped[list[Collection]] = relationship(
        back_populates="owner", cascade="all, delete-orphan", passive_deletes=True
    )
    starred_collections: Mapped[list[CollectionStar]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    starred_items: Mapped[list[ItemStar]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    schema_templates: Mapped[list[SchemaTemplate]] = relationship(
        back_populates="owner", cascade="all, delete-orphan", passive_deletes=True
    )

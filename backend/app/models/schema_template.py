from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.schema_template_field import SchemaTemplateField
    from app.models.user import User


class SchemaTemplate(Base):
    __tablename__ = "schema_templates"
    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_schema_templates_owner_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    owner: Mapped[User] = relationship(back_populates="schema_templates")
    fields: Mapped[list[SchemaTemplateField]] = relationship(
        back_populates="schema_template", cascade="all, delete-orphan", passive_deletes=True
    )

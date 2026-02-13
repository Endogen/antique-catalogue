from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.schema_template import SchemaTemplate


class SchemaTemplateField(Base):
    __tablename__ = "schema_template_fields"
    __table_args__ = (
        CheckConstraint(
            "field_type in ('text', 'number', 'date', 'timestamp', 'checkbox', 'select')",
            name="ck_schema_template_fields_type",
        ),
        UniqueConstraint(
            "schema_template_id",
            "name",
            name="uq_schema_template_fields_template_name",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    schema_template_id: Mapped[int] = mapped_column(
        ForeignKey("schema_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    field_type: Mapped[str] = mapped_column(String(20), nullable=False)
    is_required: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    is_private: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    options: Mapped[dict[str, object] | None] = mapped_column(JSON, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    schema_template: Mapped[SchemaTemplate] = relationship(back_populates="fields")

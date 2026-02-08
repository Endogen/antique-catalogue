from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""


# Import models so Alembic can discover metadata.
from app.models.email_token import EmailToken  # noqa: E402,F401
from app.models.user import User  # noqa: E402,F401

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import TokenError, decode_token
from app.db.session import get_db
from app.models.user import User


def _invalid_token() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid access token",
    )


def _authenticate_user(authorization: str, db: Session) -> User:
    """Validate a Bearer access token and return the active, verified user."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise _invalid_token()

    token = token.strip()
    if not token:
        raise _invalid_token()

    try:
        payload = decode_token(token)
    except TokenError:
        raise _invalid_token()

    if payload.get("type") != "access":
        raise _invalid_token()

    subject = payload.get("sub")
    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise _invalid_token()

    user = db.get(User, user_id)
    if not user:
        raise _invalid_token()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account locked",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified",
        )

    return user


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return _authenticate_user(authorization, db)


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    if not authorization:
        return None
    return _authenticate_user(authorization, db)

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.settings import settings
from app.db.session import get_db
from app.models.email_token import EmailToken
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    VerifyRequest,
)
from app.schemas.responses import MessageResponse
from app.services.email import send_password_reset_email, send_verification_email

VERIFY_TOKEN_EXPIRE_HOURS = 24
RESET_TOKEN_EXPIRE_HOURS = 2
TOKEN_BYTES = 48
TOKEN_MAX_ATTEMPTS = 5
REFRESH_TOKEN_EXPIRE_DAYS = 7
REFRESH_TOKEN_COOKIE = "refresh_token"
REFRESH_TOKEN_MAX_AGE = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

router = APIRouter(prefix="/auth", tags=["auth"])


def _generate_unique_token(db: Session, label: str) -> str:
    for _ in range(TOKEN_MAX_ATTEMPTS):
        token = secrets.token_urlsafe(TOKEN_BYTES)
        exists = db.execute(select(EmailToken.id).where(EmailToken.token == token)).first()
        if not exists:
            return token
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Unable to generate {label} token",
    )


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(request: RegisterRequest, db: Session = Depends(get_db)) -> MessageResponse:
    existing = db.execute(select(User).where(User.email == request.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(email=request.email, password_hash=hash_password(request.password))
    db.add(user)

    token = _generate_unique_token(db, "verification")
    expires_at = datetime.now(timezone.utc) + timedelta(hours=VERIFY_TOKEN_EXPIRE_HOURS)
    email_token = EmailToken(
        user=user,
        token=token,
        token_type="verify",
        expires_at=expires_at,
    )
    db.add(email_token)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    send_verification_email(request.email, token)
    return MessageResponse(message="Verification email sent")


def _coerce_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_TOKEN_COOKIE,
        token,
        httponly=True,
        max_age=REFRESH_TOKEN_MAX_AGE,
        samesite="lax",
        secure=False,
        path="/auth/refresh",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_TOKEN_COOKIE, path="/auth/refresh")


@router.post("/verify", response_model=MessageResponse)
def verify_email(request: VerifyRequest, db: Session = Depends(get_db)) -> MessageResponse:
    email_token = (
        db.execute(
            select(EmailToken).where(
                EmailToken.token == request.token, EmailToken.token_type == "verify"
            )
        )
        .scalars()
        .first()
    )
    if not email_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token"
        )

    user = email_token.user
    if email_token.used_at is not None:
        if user.is_verified:
            return MessageResponse(message="Email already verified")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token already used"
        )

    now = datetime.now(timezone.utc)
    expires_at = _coerce_utc(email_token.expires_at)
    if expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token expired"
        )

    if not user.is_verified:
        user.is_verified = True
    email_token.used_at = now
    db.add(user)
    db.add(email_token)
    db.commit()

    return MessageResponse(message="Email verified")


@router.post("/login", response_model=TokenResponse)
def login(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = db.execute(select(User).where(User.email == request.email)).scalar_one_or_none()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(
        str(user.id),
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    _set_refresh_cookie(response, refresh_token)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_access_token(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_TOKEN_COOKIE),
    db: Session = Depends(get_db),
) -> TokenResponse:
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    try:
        payload = decode_token(refresh_token)
    except TokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    subject = payload.get("sub")
    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")

    access_token = create_access_token(str(user.id))
    new_refresh_token = create_refresh_token(
        str(user.id),
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    _set_refresh_cookie(response, new_refresh_token)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response) -> MessageResponse:
    _clear_refresh_cookie(response)
    return MessageResponse(message="Logged out")


@router.post("/forgot", response_model=MessageResponse)
def forgot_password(
    request: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    user = db.execute(select(User).where(User.email == request.email)).scalar_one_or_none()
    if not user or not user.is_active:
        return MessageResponse(message="If the account exists, a reset email has been sent")

    token = _generate_unique_token(db, "password reset")
    expires_at = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
    email_token = EmailToken(
        user=user,
        token=token,
        token_type="reset",
        expires_at=expires_at,
    )
    db.add(email_token)
    db.commit()

    send_password_reset_email(user.email, token)
    return MessageResponse(message="If the account exists, a reset email has been sent")


@router.post("/reset", response_model=MessageResponse)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    email_token = (
        db.execute(
            select(EmailToken).where(
                EmailToken.token == request.token, EmailToken.token_type == "reset"
            )
        )
        .scalars()
        .first()
    )
    if not email_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")

    user = email_token.user
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")

    if email_token.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token already used"
        )

    now = datetime.now(timezone.utc)
    expires_at = _coerce_utc(email_token.expires_at)
    if expires_at <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token expired")

    user.password_hash = hash_password(request.password)
    email_token.used_at = now
    db.add(user)
    db.add(email_token)
    db.commit()

    return MessageResponse(message="Password reset successful")


@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user


@router.delete("/me", response_model=MessageResponse)
def delete_me(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    db.delete(current_user)
    db.commit()
    _clear_refresh_cookie(response)
    return MessageResponse(message="Account deleted")

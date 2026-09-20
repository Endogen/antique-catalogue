from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.rate_limit import rate_limit
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
from app.models.auth_session import AuthSession
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
from app.services.email import (
    EmailDeliveryError,
    send_password_reset_email,
    send_verification_email,
)
from app.services.uploads import delete_user_uploads

VERIFY_TOKEN_EXPIRE_HOURS = 24
RESET_TOKEN_EXPIRE_HOURS = 2
TOKEN_BYTES = 48
TOKEN_MAX_ATTEMPTS = 5
REFRESH_TOKEN_EXPIRE_DAYS = 7
REFRESH_TOKEN_COOKIE = "refresh_token"
REFRESH_TOKEN_MAX_AGE = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

router = APIRouter(prefix="/auth", tags=["auth"])

# Per-IP limits on credential and token endpoints to slow down brute force
# and account enumeration. Counters are per process; see app.core.rate_limit.
login_rate_limit = rate_limit("auth:login", limit=10, window_seconds=60)
register_rate_limit = rate_limit("auth:register", limit=10, window_seconds=600)
verify_rate_limit = rate_limit("auth:verify", limit=10, window_seconds=60)
forgot_rate_limit = rate_limit("auth:forgot", limit=5, window_seconds=900)
reset_rate_limit = rate_limit("auth:reset", limit=10, window_seconds=60)


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
    dependencies=[Depends(register_rate_limit)],
)
def register(request: RegisterRequest, db: Session = Depends(get_db)) -> MessageResponse:
    existing = db.execute(select(User).where(User.email == request.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(email=request.email, password_hash=hash_password(request.password))
    if settings.auto_verify_email:
        user.is_verified = True
    db.add(user)
    db.flush()
    user.username = str(user.id)

    token: str | None = None
    if not settings.auto_verify_email:
        token = _generate_unique_token(db, "verification")
        expires_at = datetime.now(timezone.utc) + timedelta(hours=VERIFY_TOKEN_EXPIRE_HOURS)
        email_token = EmailToken(
            user=user,
            token=token,
            token_type="verify",
            expires_at=expires_at,
        )
        db.add(email_token)

    if settings.auto_verify_email:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
            )
        return MessageResponse(message="Account created")

    try:
        send_verification_email(request.email, token or "")
        db.commit()
    except EmailDeliveryError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification email could not be sent. Please try again later.",
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

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
        secure=settings.refresh_token_cookie_secure,
        path=settings.refresh_token_cookie_path,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_TOKEN_COOKIE, path=settings.refresh_token_cookie_path)


@router.post("/verify", response_model=MessageResponse, dependencies=[Depends(verify_rate_limit)])
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


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(login_rate_limit)])
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account locked")

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")

    db.execute(delete(AuthSession).where(AuthSession.expires_at <= datetime.now(timezone.utc)))
    session = AuthSession(
        id=secrets.token_hex(32),
        user_id=user.id,
        refresh_id=secrets.token_hex(32),
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()
    claims = {"ver": user.session_version, "sid": session.id}
    access_token = create_access_token(str(user.id), additional_claims=claims)
    refresh_token = create_refresh_token(
        str(user.id),
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        additional_claims={**claims, "jti": session.refresh_id},
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
    if not user or not user.is_active or payload.get("ver", 0) != user.session_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")

    session_id = payload.get("sid")
    refresh_id = secrets.token_hex(32)
    rotated = db.execute(
        update(AuthSession)
        .where(
            AuthSession.id == session_id,
            AuthSession.user_id == user.id,
            AuthSession.refresh_id == payload.get("jti"),
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
        .values(
            refresh_id=refresh_id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    if rotated.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    db.commit()
    claims = {"ver": user.session_version, "sid": session_id}
    access_token = create_access_token(str(user.id), additional_claims=claims)
    new_refresh_token = create_refresh_token(
        str(user.id),
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        additional_claims={**claims, "jti": refresh_id},
    )
    _set_refresh_cookie(response, new_refresh_token)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_TOKEN_COOKIE),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") == "refresh":
                db.execute(delete(AuthSession).where(AuthSession.id == payload.get("sid")))
                db.commit()
        except TokenError:
            pass
    _clear_refresh_cookie(response)
    return MessageResponse(message="Logged out")


@router.post("/forgot", response_model=MessageResponse, dependencies=[Depends(forgot_rate_limit)])
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
    try:
        send_password_reset_email(user.email, token)
        db.commit()
    except EmailDeliveryError:
        db.rollback()
        return MessageResponse(message="If the account exists, a reset email has been sent")

    return MessageResponse(message="If the account exists, a reset email has been sent")


@router.post("/reset", response_model=MessageResponse, dependencies=[Depends(reset_rate_limit)])
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
    user.session_version += 1
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.execute(
        update(EmailToken)
        .where(EmailToken.user_id == user.id, EmailToken.used_at.is_(None))
        .values(used_at=now)
    )
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
    user_id = current_user.id
    db.delete(current_user)
    db.commit()
    delete_user_uploads(user_id)
    _clear_refresh_cookie(response)
    return MessageResponse(message="Account deleted")


def _deliver_email(sender, email: str, token: str) -> None:
    try:
        sender(email, token)
    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=503,
            detail="Email delivery is temporarily unavailable. Please request a new email.",
        ) from exc


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit("resend-verification", limit=5, window_seconds=60))],
)
def resend_verification(
    request: ForgotPasswordRequest, db: Session = Depends(get_db)
) -> MessageResponse:
    user = db.execute(select(User).where(User.email == request.email)).scalar_one_or_none()
    message = "If the account needs verification, a new email has been sent."
    if not user or not user.is_active or user.is_verified:
        return MessageResponse(message=message)
    now = datetime.now(timezone.utc)
    db.execute(
        update(EmailToken)
        .where(
            EmailToken.user_id == user.id,
            EmailToken.token_type == "verify",
            EmailToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    token = _generate_unique_token(db, "verification")
    db.add(
        EmailToken(
            user_id=user.id,
            token=token,
            token_type="verify",
            expires_at=now + timedelta(hours=VERIFY_TOKEN_EXPIRE_HOURS),
        )
    )
    # Deliver first, then commit: a failed send must roll back so the previous
    # verification token stays valid and no orphaned token is left behind.
    try:
        _deliver_email(send_verification_email, user.email, token)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    return MessageResponse(message=message)

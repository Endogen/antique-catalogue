from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core.settings import settings


class TokenError(ValueError):
    """Raised when a JWT token cannot be decoded or validated."""


_PWD_ALGORITHM = "pbkdf2_sha256"
# OWASP recommendation for PBKDF2-HMAC-SHA256 (2023+). The iteration count is
# stored in each hash, so older hashes keep verifying after this changes.
_PWD_ITERATIONS = 600_000
# Upper bound on the stored iteration count. Legitimate hashes use
# _PWD_ITERATIONS (or a smaller legacy count); this only rejects a corrupted or
# maliciously crafted hash that would otherwise turn a login into a CPU denial
# of service.
_PWD_MAX_ITERATIONS = 5_000_000
_PWD_SALT_BYTES = 16

_JWT_ALGORITHMS = {"HS256"}


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _hash_password_raw(password: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)


def hash_password(password: str) -> str:
    salt = os.urandom(_PWD_SALT_BYTES)
    digest = _hash_password_raw(password, salt, _PWD_ITERATIONS)
    return f"{_PWD_ALGORITHM}${_PWD_ITERATIONS}${_b64url_encode(salt)}${_b64url_encode(digest)}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        algorithm, iterations_str, salt_b64, digest_b64 = hashed_password.split("$", 3)
        if algorithm != _PWD_ALGORITHM:
            return False
        iterations = int(iterations_str)
        if not 1 <= iterations <= _PWD_MAX_ITERATIONS:
            return False
        salt = _b64url_decode(salt_b64)
        expected = _b64url_decode(digest_b64)
    except (ValueError, TypeError):
        return False

    computed = _hash_password_raw(plain_password, salt, iterations)
    return hmac.compare_digest(computed, expected)


def _build_token_payload(
    subject: str,
    token_type: str,
    expires_delta: timedelta | None = None,
    additional_claims: dict[str, Any] | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)
    expire = now + expires_delta
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if additional_claims:
        payload.update(additional_claims)
    return payload


def _require_supported_algorithm() -> str:
    if settings.jwt_algorithm not in _JWT_ALGORITHMS:
        raise TokenError("Unsupported JWT algorithm")
    return settings.jwt_algorithm


def _jwt_encode(payload: dict[str, Any]) -> str:
    algorithm = _require_supported_algorithm()
    return jwt.encode(payload, settings.jwt_secret, algorithm=algorithm)


def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
    additional_claims: dict[str, Any] | None = None,
) -> str:
    payload = _build_token_payload(subject, "access", expires_delta, additional_claims)
    return _jwt_encode(payload)


def create_refresh_token(
    subject: str,
    expires_delta: timedelta,
    additional_claims: dict[str, Any] | None = None,
) -> str:
    payload = _build_token_payload(subject, "refresh", expires_delta, additional_claims)
    return _jwt_encode(payload)


def create_admin_token(
    subject: str,
    expires_delta: timedelta | None = None,
    additional_claims: dict[str, Any] | None = None,
) -> str:
    payload = _build_token_payload(subject, "admin", expires_delta, additional_claims)
    return _jwt_encode(payload)


def decode_token(token: str) -> dict[str, Any]:
    algorithm = _require_supported_algorithm()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Invalid token") from exc

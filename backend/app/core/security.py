from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.settings import settings


class TokenError(ValueError):
    """Raised when a JWT token cannot be decoded or validated."""


_PWD_ALGORITHM = "pbkdf2_sha256"
_PWD_ITERATIONS = 100_000
_PWD_SALT_BYTES = 16


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


def _jwt_encode(payload: dict[str, Any]) -> str:
    header = {"alg": settings.jwt_algorithm, "typ": "JWT"}
    if settings.jwt_algorithm != "HS256":
        raise TokenError("Unsupported JWT algorithm")
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(settings.jwt_secret.encode("utf-8"), signing_input, hashlib.sha256)
    signature_b64 = _b64url_encode(signature.digest())
    return f"{header_b64}.{payload_b64}.{signature_b64}"


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


def decode_token(token: str) -> dict[str, Any]:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise TokenError("Invalid token") from exc

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_signature = hmac.new(
        settings.jwt_secret.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    signature = _b64url_decode(signature_b64)
    if not hmac.compare_digest(signature, expected_signature):
        raise TokenError("Invalid token")

    try:
        header = json.loads(_b64url_decode(header_b64))
        payload = json.loads(_b64url_decode(payload_b64))
    except (json.JSONDecodeError, ValueError) as exc:
        raise TokenError("Invalid token") from exc

    if header.get("alg") != settings.jwt_algorithm:
        raise TokenError("Invalid token")

    exp = payload.get("exp")
    if exp is not None:
        now = int(datetime.now(timezone.utc).timestamp())
        if now >= int(exp):
            raise TokenError("Token expired")

    return payload

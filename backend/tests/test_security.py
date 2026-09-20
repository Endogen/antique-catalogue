from __future__ import annotations

from datetime import timedelta

import pytest

from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password() -> None:
    password = "super-secret"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_verify_password_rejects_absurd_iteration_counts() -> None:
    password = "super-secret"
    algorithm, _, salt_b64, digest_b64 = hash_password(password).split("$", 3)

    # A crafted hash that asks for an unreasonable amount of work must be
    # rejected up front rather than turning the login into a CPU denial of
    # service.
    bomb = f"{algorithm}${10**9}${salt_b64}${digest_b64}"
    assert verify_password(password, bomb) is False

    # Zero and negative counts are equally invalid and would make
    # hashlib.pbkdf2_hmac raise.
    for iterations in ("0", "-1"):
        assert verify_password(password, f"{algorithm}${iterations}${salt_b64}${digest_b64}") is False


def test_create_and_decode_access_token() -> None:
    token = create_access_token("user-123")
    payload = decode_token(token)

    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"
    assert "exp" in payload
    assert "iat" in payload


def test_create_and_decode_refresh_token() -> None:
    token = create_refresh_token("user-456", expires_delta=timedelta(days=7))
    payload = decode_token(token)

    assert payload["sub"] == "user-456"
    assert payload["type"] == "refresh"


def test_decode_expired_token_raises() -> None:
    token = create_access_token("user-789", expires_delta=timedelta(seconds=-10))
    with pytest.raises(TokenError):
        decode_token(token)

from __future__ import annotations

import asyncio

import httpx
import pytest

from app.api.auth import login_rate_limit
from app.core.rate_limit import SlidingWindowRateLimiter
from app.core.security import hash_password
from app.models.user import User


def _create_user(session_factory, *, email: str, password: str) -> int:
    session = session_factory()
    try:
        user = User(
            email=email,
            password_hash=hash_password(password),
            is_verified=True,
        )
        session.add(user)
        session.flush()
        user.username = str(user.id)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def test_limiter_allows_up_to_limit_then_blocks() -> None:
    limiter = SlidingWindowRateLimiter(limit=3, window_seconds=60)

    for _ in range(3):
        assert limiter.hit("key") is None

    retry_after = limiter.hit("key")
    assert retry_after is not None
    assert 0 < retry_after <= 60

    # Other keys are unaffected.
    assert limiter.hit("other") is None


def test_limiter_recovers_after_window() -> None:
    limiter = SlidingWindowRateLimiter(limit=1, window_seconds=0.05)

    assert limiter.hit("key") is None
    assert limiter.hit("key") is not None

    import time

    time.sleep(0.06)
    assert limiter.hit("key") is None


def test_limiter_reset_clears_counters() -> None:
    limiter = SlidingWindowRateLimiter(limit=1, window_seconds=60)
    assert limiter.hit("key") is None
    assert limiter.hit("key") is not None
    limiter.reset()
    assert limiter.hit("key") is None


def test_limiter_rejects_invalid_configuration() -> None:
    with pytest.raises(ValueError):
        SlidingWindowRateLimiter(limit=0, window_seconds=60)
    with pytest.raises(ValueError):
        SlidingWindowRateLimiter(limit=1, window_seconds=0)


def test_login_endpoint_returns_429_over_limit(app_with_db, db_session_factory) -> None:
    email = "rate-limited@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {"email": email, "password": "wrong-password"}
            for _ in range(10):
                response = await client.post("/auth/login", json=payload)
                assert response.status_code == 401

            blocked = await client.post("/auth/login", json=payload)
            assert blocked.status_code == 429
            assert "Retry-After" in blocked.headers
            assert int(blocked.headers["Retry-After"]) >= 1

            # Correct credentials are also rejected while the window is full.
            blocked_valid = await client.post(
                "/auth/login", json={"email": email, "password": password}
            )
            assert blocked_valid.status_code == 429

    asyncio.run(_flow())


def test_login_limit_resets_between_tests(app_with_db, db_session_factory) -> None:
    """The autouse fixture must clear limiter state between tests."""
    email = "rate-reset@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/auth/login", json={"email": email, "password": password}
            )
            assert response.status_code == 200

    asyncio.run(_flow())
    assert login_rate_limit is not None

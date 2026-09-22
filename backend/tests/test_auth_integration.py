from __future__ import annotations

import asyncio

import httpx
import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.models.email_token import EmailToken
from app.models.user import User


def _create_user(session_factory, *, email: str, password: str, verified: bool = True) -> int:
    session = session_factory()
    try:
        user = User(
            email=email,
            password_hash=hash_password(password),
            is_verified=verified,
        )
        session.add(user)
        session.flush()
        user.username = str(user.id)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _get_token(session_factory, *, email: str, token_type: str) -> str:
    session = session_factory()
    try:
        query = (
            select(EmailToken.token)
            .join(User)
            .where(User.email == email, EmailToken.token_type == token_type)
        )
        return session.execute(query).scalar_one()
    finally:
        session.close()


@pytest.fixture(autouse=True)
def _stub_email_delivery(monkeypatch):
    from app.api import auth as auth_api

    monkeypatch.setattr(auth_api, "send_verification_email", lambda to_email, token: None)
    monkeypatch.setattr(auth_api, "send_password_reset_email", lambda to_email, token: None)


def test_register_verify_login_and_me(app_with_db, db_session_factory) -> None:
    email = "collector@example.com"
    password = "strongpass"

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/auth/register",
                json={"email": email, "password": password},
            )
            assert response.status_code == 201

            duplicate = await client.post(
                "/auth/register",
                json={"email": email, "password": password},
            )
            assert duplicate.status_code == 409

            login = await client.post(
                "/auth/login",
                json={"email": email, "password": password},
            )
            assert login.status_code == 403
            assert login.json()["detail"] == "Email not verified"

            token = _get_token(db_session_factory, email=email, token_type="verify")
            verify = await client.post("/auth/verify", json={"token": token})
            assert verify.status_code == 200
            assert verify.json()["message"] == "Email verified"

            verify_again = await client.post("/auth/verify", json={"token": token})
            assert verify_again.status_code == 200
            assert verify_again.json()["message"] == "Email already verified"

            session = db_session_factory()
            try:
                user = session.execute(select(User).where(User.email == email)).scalar_one()
                assert user.is_verified is True
                email_token = session.execute(
                    select(EmailToken).where(EmailToken.token == token)
                ).scalar_one()
                assert email_token.used_at is not None
            finally:
                session.close()

            me_unauth = await client.get("/auth/me")
            assert me_unauth.status_code == 401

            login_verified = await client.post(
                "/auth/login",
                json={"email": email, "password": password},
            )
            assert login_verified.status_code == 200
            access_token = login_verified.json()["access_token"]

            me = await client.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            assert me.status_code == 200
            assert me.json()["email"] == email
            assert me.json()["username"] == str(user.id)

    asyncio.run(_flow())


def test_register_rolls_back_when_verification_email_fails(
    app_with_db, db_session_factory, monkeypatch
) -> None:
    from app.api import auth as auth_api

    email = "delivery-fail@example.com"
    password = "strongpass"

    previous_auto_verify = auth_api.settings.auto_verify_email
    previous_smtp_host = auth_api.settings.smtp_host
    previous_smtp_from = auth_api.settings.smtp_from
    object.__setattr__(auth_api.settings, "auto_verify_email", False)
    object.__setattr__(auth_api.settings, "smtp_host", "smtp.example.com")
    object.__setattr__(auth_api.settings, "smtp_from", "noreply@example.com")

    def failing_send_verification_email(to_email: str, token: str) -> None:
        raise auth_api.EmailDeliveryError("smtp rejected message")

    monkeypatch.setattr(auth_api, "send_verification_email", failing_send_verification_email)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/auth/register",
                json={"email": email, "password": password},
            )
            assert response.status_code == 503
            assert response.json()["detail"] == (
                "Verification email could not be sent. Please try again later."
            )

        session = db_session_factory()
        try:
            assert (
                session.execute(select(User).where(User.email == email)).scalar_one_or_none()
                is None
            )
            assert (
                session.execute(
                    select(EmailToken).join(User).where(User.email == email)
                ).scalar_one_or_none()
                is None
            )
        finally:
            session.close()

    try:
        asyncio.run(_flow())
    finally:
        object.__setattr__(auth_api.settings, "auto_verify_email", previous_auto_verify)
        object.__setattr__(auth_api.settings, "smtp_host", previous_smtp_host)
        object.__setattr__(auth_api.settings, "smtp_from", previous_smtp_from)


def test_forgot_password_rolls_back_reset_token_when_email_fails(
    app_with_db, db_session_factory, monkeypatch
) -> None:
    from app.api import auth as auth_api

    email = "reset-fail@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    previous_smtp_host = auth_api.settings.smtp_host
    previous_smtp_from = auth_api.settings.smtp_from
    object.__setattr__(auth_api.settings, "smtp_host", "smtp.example.com")
    object.__setattr__(auth_api.settings, "smtp_from", "noreply@example.com")

    def failing_send_reset_email(to_email: str, token: str) -> None:
        raise auth_api.EmailDeliveryError("smtp rejected message")

    monkeypatch.setattr(auth_api, "send_password_reset_email", failing_send_reset_email)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/auth/forgot", json={"email": email})
            assert response.status_code == 200
            assert response.json()["message"] == (
                "If the account exists, a reset email has been sent"
            )

        session = db_session_factory()
        try:
            assert (
                session.execute(
                    select(EmailToken).join(User).where(
                        User.email == email, EmailToken.token_type == "reset"
                    )
                ).scalar_one_or_none()
                is None
            )
        finally:
            session.close()

    try:
        asyncio.run(_flow())
    finally:
        object.__setattr__(auth_api.settings, "smtp_host", previous_smtp_host)
        object.__setattr__(auth_api.settings, "smtp_from", previous_smtp_from)


def test_refresh_logout_and_reset(app_with_db, db_session_factory) -> None:
    email = "verified@example.com"
    password = "initialpass"
    new_password = "newstrongpass"

    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            login = await client.post(
                "/auth/login",
                json={"email": email, "password": password},
            )
            assert login.status_code == 200
            access_token = login.json()["access_token"]

            refresh = await client.post("/auth/refresh")
            assert refresh.status_code == 200
            assert refresh.json()["access_token"]

            logout = await client.post("/auth/logout")
            assert logout.status_code == 200
            assert "refresh_token=" in logout.headers.get("set-cookie", "")

            refresh_after_logout = await client.post("/auth/refresh")
            assert refresh_after_logout.status_code == 401

            forgot = await client.post("/auth/forgot", json={"email": email})
            assert forgot.status_code == 200

            reset_token = _get_token(db_session_factory, email=email, token_type="reset")
            reset = await client.post(
                "/auth/reset",
                json={"token": reset_token, "password": new_password},
            )
            assert reset.status_code == 200
            assert reset.json()["message"] == "Password reset successful"

            session = db_session_factory()
            try:
                token_row = session.execute(
                    select(EmailToken).where(EmailToken.token == reset_token)
                ).scalar_one()
                assert token_row.used_at is not None
            finally:
                session.close()

            login_new = await client.post(
                "/auth/login",
                json={"email": email, "password": new_password},
            )
            assert login_new.status_code == 200
            assert login_new.json()["access_token"]

            me = await client.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            assert me.status_code == 401

    asyncio.run(_flow())


def test_delete_account(app_with_db, db_session_factory) -> None:
    email = "delete@example.com"
    password = "deletepass"

    user_id = _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            login = await client.post(
                "/auth/login",
                json={"email": email, "password": password},
            )
            assert login.status_code == 200
            access_token = login.json()["access_token"]

            delete = await client.delete(
                "/auth/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            assert delete.status_code == 200
            assert delete.json()["message"] == "Account deleted"

            me_after = await client.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            assert me_after.status_code == 401

    asyncio.run(_flow())

    session = db_session_factory()
    try:
        assert session.get(User, user_id) is None
    finally:
        session.close()


def test_forgot_password_unknown_email(app_with_db) -> None:
    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/auth/forgot",
                json={"email": "unknown@example.com"},
            )
            assert response.status_code == 200
            expected = "If the account exists, a reset email has been sent"
            assert response.json()["message"] == expected

    asyncio.run(_flow())

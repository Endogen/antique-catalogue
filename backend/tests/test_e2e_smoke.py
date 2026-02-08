from __future__ import annotations

import asyncio
from contextlib import contextmanager
from importlib.util import find_spec
from io import BytesIO

import httpx
from sqlalchemy import select

from app.core.settings import settings
from app.models.email_token import EmailToken
from app.models.user import User

try:
    from PIL import Image
except ModuleNotFoundError:  # pragma: no cover - optional dependency in tests
    Image = None
    PIL_AVAILABLE = False
else:
    PIL_AVAILABLE = True

MULTIPART_AVAILABLE = find_spec("multipart") is not None


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


def _image_payload() -> bytes:
    if Image is None:
        raise RuntimeError("Pillow not available")
    image = Image.new("RGB", (640, 480), color=(120, 25, 200))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@contextmanager
def _temp_uploads_dir(path):
    previous = settings.uploads_path
    object.__setattr__(settings, "uploads_path", str(path))
    try:
        yield
    finally:
        object.__setattr__(settings, "uploads_path", previous)


def test_end_to_end_smoke(app_with_db, db_session_factory, tmp_path) -> None:
    email = "smoke@example.com"
    password = "strongpass"
    new_password = "newstrongpass"

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            register = await client.post(
                "/auth/register",
                json={"email": email, "password": password},
            )
            assert register.status_code == 201

            verify_token = _get_token(db_session_factory, email=email, token_type="verify")
            verify = await client.post("/auth/verify", json={"token": verify_token})
            assert verify.status_code == 200

            login = await client.post(
                "/auth/login",
                json={"email": email, "password": password},
            )
            assert login.status_code == 200
            access_token = login.json()["access_token"]
            headers = {"Authorization": f"Bearer {access_token}"}

            me = await client.get("/auth/me", headers=headers)
            assert me.status_code == 200
            assert me.json()["email"] == email

            collection = await client.post(
                "/collections",
                json={"name": "Smoke Collection"},
                headers=headers,
            )
            assert collection.status_code == 201
            collection_id = collection.json()["id"]

            field_condition = await client.post(
                f"/collections/{collection_id}/fields",
                json={
                    "name": "Condition",
                    "field_type": "select",
                    "is_required": True,
                    "options": {"options": ["Excellent", "Good"]},
                },
                headers=headers,
            )
            assert field_condition.status_code == 201

            field_year = await client.post(
                f"/collections/{collection_id}/fields",
                json={"name": "Year", "field_type": "number"},
                headers=headers,
            )
            assert field_year.status_code == 201

            item = await client.post(
                f"/collections/{collection_id}/items",
                json={
                    "name": "Brass Telescope",
                    "metadata": {"Condition": "Excellent", "Year": 1901},
                },
                headers=headers,
            )
            assert item.status_code == 201
            item_id = item.json()["id"]

            image_id: int | None = None
            if PIL_AVAILABLE and MULTIPART_AVAILABLE:
                payload = _image_payload()
                upload = await client.post(
                    f"/items/{item_id}/images",
                    files={"file": ("telescope.png", payload, "image/png")},
                    headers=headers,
                )
                assert upload.status_code == 201
                image_id = upload.json()["id"]

                listing = await client.get(f"/items/{item_id}/images", headers=headers)
                assert listing.status_code == 200
                assert any(image["id"] == image_id for image in listing.json())

                served = await client.get(f"/images/{image_id}/thumb.jpg", headers=headers)
                assert served.status_code == 200
                assert served.headers["content-type"] == "image/jpeg"

            make_public = await client.patch(
                f"/collections/{collection_id}",
                json={"is_public": True},
                headers=headers,
            )
            assert make_public.status_code == 200

            public_collection = await client.get(f"/public/collections/{collection_id}")
            assert public_collection.status_code == 200

            public_items = await client.get(f"/public/collections/{collection_id}/items")
            assert public_items.status_code == 200
            assert any(public_item["id"] == item_id for public_item in public_items.json())

            if image_id is not None:
                public_image = await client.get(f"/images/{image_id}/thumb.jpg")
                assert public_image.status_code == 200

            forgot = await client.post("/auth/forgot", json={"email": email})
            assert forgot.status_code == 200

            reset_token = _get_token(db_session_factory, email=email, token_type="reset")
            reset = await client.post(
                "/auth/reset",
                json={"token": reset_token, "password": new_password},
            )
            assert reset.status_code == 200

            relogin = await client.post(
                "/auth/login",
                json={"email": email, "password": new_password},
            )
            assert relogin.status_code == 200
            new_access_token = relogin.json()["access_token"]

            delete = await client.delete(
                "/auth/me",
                headers={"Authorization": f"Bearer {new_access_token}"},
            )
            assert delete.status_code == 200

            after_delete = await client.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {new_access_token}"},
            )
            assert after_delete.status_code == 401

    with _temp_uploads_dir(tmp_path):
        asyncio.run(_flow())

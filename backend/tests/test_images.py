from __future__ import annotations

import asyncio
from contextlib import contextmanager
from importlib.util import find_spec
from io import BytesIO
from pathlib import Path

import httpx
import pytest

try:
    from PIL import Image
except ModuleNotFoundError:  # pragma: no cover - optional dependency in tests
    Image = None
    PIL_AVAILABLE = False
else:
    PIL_AVAILABLE = True

from app.core.security import hash_password
from app.core.settings import settings
from app.models.user import User

MULTIPART_AVAILABLE = find_spec("multipart") is not None

pytestmark = pytest.mark.skipif(
    not PIL_AVAILABLE or not MULTIPART_AVAILABLE,
    reason="Pillow or python-multipart not installed",
)


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


async def _login(client: httpx.AsyncClient, *, email: str, password: str) -> str:
    response = await client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


async def _create_collection(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    *,
    name: str = "Cameras",
    is_public: bool = False,
) -> int:
    response = await client.post(
        "/collections",
        json={"name": name, "is_public": is_public},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


async def _create_item(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    collection_id: int,
    *,
    name: str = "Item",
) -> int:
    response = await client.post(
        f"/collections/{collection_id}/items",
        json={"name": name},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def _image_payload() -> bytes:
    image = Image.new("RGB", (640, 480), color=(120, 25, 200))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@contextmanager
def _temp_uploads_dir(path: Path):
    previous = settings.uploads_path
    object.__setattr__(settings, "uploads_path", str(path))
    try:
        yield
    finally:
        object.__setattr__(settings, "uploads_path", previous)


def test_image_upload_reorder_delete(app_with_db, db_session_factory, tmp_path) -> None:
    email = "images@example.com"
    password = "strongpass"
    user_id = _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            collection_id = await _create_collection(client, headers, name="Image Collection")
            item_id = await _create_item(client, headers, collection_id, name="Camera")

            payload = _image_payload()
            upload_one = await client.post(
                f"/items/{item_id}/images",
                files={"file": ("one.png", payload, "image/png")},
                headers=headers,
            )
            assert upload_one.status_code == 201
            image_one = upload_one.json()
            assert image_one["position"] == 0
            upload_dir = settings.uploads_dir / str(user_id) / str(collection_id) / str(item_id)
            assert (upload_dir / f"{image_one['id']}_original.jpg").exists()
            assert (upload_dir / f"{image_one['id']}_thumb.jpg").exists()

            upload_two = await client.post(
                f"/items/{item_id}/images",
                files={"file": ("two.png", payload, "image/png")},
                headers=headers,
            )
            assert upload_two.status_code == 201
            image_two = upload_two.json()
            assert image_two["position"] == 1

            listing = await client.get(f"/items/{item_id}/images", headers=headers)
            assert listing.status_code == 200
            assert [image["id"] for image in listing.json()] == [
                image_one["id"],
                image_two["id"],
            ]

            reorder = await client.patch(
                f"/items/{item_id}/images/{image_two['id']}",
                headers=headers,
                json={"position": 0},
            )
            assert reorder.status_code == 200
            assert reorder.json()["position"] == 0

            updated_listing = await client.get(f"/items/{item_id}/images", headers=headers)
            assert updated_listing.status_code == 200
            assert [image["id"] for image in updated_listing.json()] == [
                image_two["id"],
                image_one["id"],
            ]
            assert [image["position"] for image in updated_listing.json()] == [0, 1]

            out_of_range = await client.patch(
                f"/items/{item_id}/images/{image_two['id']}",
                headers=headers,
                json={"position": 5},
            )
            assert out_of_range.status_code == 422
            assert out_of_range.json()["detail"] == "Position out of range"

            delete = await client.delete(
                f"/items/{item_id}/images/{image_one['id']}",
                headers=headers,
            )
            assert delete.status_code == 200
            assert delete.json()["message"] == "Image deleted"
            assert not (upload_dir / f"{image_one['id']}_original.jpg").exists()
            assert not (upload_dir / f"{image_one['id']}_thumb.jpg").exists()

            after_delete = await client.get(f"/items/{item_id}/images", headers=headers)
            assert after_delete.status_code == 200
            assert [image["id"] for image in after_delete.json()] == [image_two["id"]]

    with _temp_uploads_dir(tmp_path):
        asyncio.run(_flow())


def test_image_serving_public_access(app_with_db, db_session_factory, tmp_path) -> None:
    owner_email = "owner-images@example.com"
    owner_password = "strongpass"
    other_email = "other-images@example.com"
    other_password = "strongpass"

    _create_user(db_session_factory, email=owner_email, password=owner_password, verified=True)
    _create_user(db_session_factory, email=other_email, password=other_password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            owner_token = await _login(client, email=owner_email, password=owner_password)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}

            other_token = await _login(client, email=other_email, password=other_password)
            other_headers = {"Authorization": f"Bearer {other_token}"}

            collection_id = await _create_collection(client, owner_headers, name="Private")
            item_id = await _create_item(client, owner_headers, collection_id, name="Lamp")

            payload = _image_payload()
            upload = await client.post(
                f"/items/{item_id}/images",
                files={"file": ("lamp.png", payload, "image/png")},
                headers=owner_headers,
            )
            assert upload.status_code == 201
            image_id = upload.json()["id"]

            private_serve = await client.get(f"/images/{image_id}/thumb.jpg")
            assert private_serve.status_code == 404

            owner_serve = await client.get(
                f"/images/{image_id}/thumb.jpg",
                headers=owner_headers,
            )
            assert owner_serve.status_code == 200
            assert owner_serve.headers["content-type"] == "image/jpeg"
            assert owner_serve.headers["cache-control"] == (
                "no-store, no-cache, must-revalidate, max-age=0"
            )
            assert owner_serve.headers["pragma"] == "no-cache"
            assert owner_serve.headers["expires"] == "0"

            invalid_variant = await client.get(
                f"/images/{image_id}/giant.jpg",
                headers=owner_headers,
            )
            assert invalid_variant.status_code == 422

            make_public = await client.patch(
                f"/collections/{collection_id}",
                headers=owner_headers,
                json={"is_public": True},
            )
            assert make_public.status_code == 200

            public_serve = await client.get(f"/images/{image_id}/thumb.jpg")
            assert public_serve.status_code == 200
            assert public_serve.headers["cache-control"] == (
                "public, max-age=31536000, immutable"
            )

            other_serve = await client.get(
                f"/images/{image_id}/thumb.jpg",
                headers=other_headers,
            )
            assert other_serve.status_code == 200

            public_list = await client.get(f"/items/{item_id}/images")
            assert public_list.status_code == 200
            assert public_list.json()[0]["id"] == image_id

            other_list = await client.get(
                f"/items/{item_id}/images",
                headers=other_headers,
            )
            assert other_list.status_code == 200
            assert other_list.json()[0]["id"] == image_id

    with _temp_uploads_dir(tmp_path):
        asyncio.run(_flow())

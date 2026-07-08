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


def _image_payload() -> bytes:
    image = Image.new("RGB", (320, 240), color=(90, 120, 40))
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


async def _setup_item_with_image(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    *,
    collection_name: str = "Cameras",
) -> tuple[int, int, int]:
    create_collection = await client.post(
        "/collections",
        json={"name": collection_name},
        headers=headers,
    )
    assert create_collection.status_code == 201
    collection_id = create_collection.json()["id"]

    create_item = await client.post(
        f"/collections/{collection_id}/items",
        json={"name": "Boxed Item"},
        headers=headers,
    )
    assert create_item.status_code == 201
    item_id = create_item.json()["id"]

    upload = await client.post(
        f"/items/{item_id}/images",
        files={"file": ("photo.png", _image_payload(), "image/png")},
        headers=headers,
    )
    assert upload.status_code == 201
    image_id = upload.json()["id"]
    return collection_id, item_id, image_id


def test_item_delete_removes_files(app_with_db, db_session_factory, tmp_path) -> None:
    email = "files-item@example.com"
    password = "strongpass"
    user_id = _create_user(db_session_factory, email=email, password=password)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {token}"}
            collection_id, item_id, _ = await _setup_item_with_image(client, headers)

            item_dir = tmp_path / str(user_id) / str(collection_id) / str(item_id)
            assert item_dir.exists()
            assert list(item_dir.glob("*.jpg"))

            delete = await client.delete(
                f"/collections/{collection_id}/items/{item_id}", headers=headers
            )
            assert delete.status_code == 200
            assert not item_dir.exists()

    with _temp_uploads_dir(tmp_path):
        asyncio.run(_flow())


def test_collection_delete_removes_files(app_with_db, db_session_factory, tmp_path) -> None:
    email = "files-collection@example.com"
    password = "strongpass"
    user_id = _create_user(db_session_factory, email=email, password=password)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {token}"}
            collection_id, _, _ = await _setup_item_with_image(client, headers)

            collection_dir = tmp_path / str(user_id) / str(collection_id)
            assert collection_dir.exists()

            delete = await client.delete(f"/collections/{collection_id}", headers=headers)
            assert delete.status_code == 200
            assert not collection_dir.exists()

    with _temp_uploads_dir(tmp_path):
        asyncio.run(_flow())


def test_account_delete_removes_files(app_with_db, db_session_factory, tmp_path) -> None:
    email = "files-account@example.com"
    password = "strongpass"
    user_id = _create_user(db_session_factory, email=email, password=password)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {token}"}
            await _setup_item_with_image(client, headers)

            upload_avatar = await client.post(
                "/profiles/me/avatar",
                files={"file": ("avatar.png", _image_payload(), "image/png")},
                headers=headers,
            )
            assert upload_avatar.status_code == 200

            user_dir = tmp_path / str(user_id)
            avatar_dir = tmp_path / "avatars" / str(user_id)
            assert user_dir.exists()
            assert avatar_dir.exists()

            delete = await client.delete("/auth/me", headers=headers)
            assert delete.status_code == 200
            assert not user_dir.exists()
            assert not avatar_dir.exists()

    with _temp_uploads_dir(tmp_path):
        asyncio.run(_flow())


def test_moving_item_moves_files_and_keeps_images_served(
    app_with_db, db_session_factory, tmp_path
) -> None:
    email = "files-move@example.com"
    password = "strongpass"
    user_id = _create_user(db_session_factory, email=email, password=password)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {token}"}
            source_collection_id, item_id, image_id = await _setup_item_with_image(
                client, headers
            )

            create_target = await client.post(
                "/collections",
                json={"name": "Target Shelf"},
                headers=headers,
            )
            assert create_target.status_code == 201
            target_collection_id = create_target.json()["id"]

            move = await client.patch(
                f"/collections/{source_collection_id}/items/{item_id}",
                json={"collection_id": target_collection_id},
                headers=headers,
            )
            assert move.status_code == 200
            assert move.json()["collection_id"] == target_collection_id

            source_dir = tmp_path / str(user_id) / str(source_collection_id) / str(item_id)
            target_dir = tmp_path / str(user_id) / str(target_collection_id) / str(item_id)
            assert not source_dir.exists()
            assert target_dir.exists()
            assert list(target_dir.glob("*.jpg"))

            served = await client.get(f"/images/{image_id}/thumb.jpg", headers=headers)
            assert served.status_code == 200
            assert served.headers["content-type"] == "image/jpeg"

    with _temp_uploads_dir(tmp_path):
        asyncio.run(_flow())

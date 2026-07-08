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


async def _login(client: httpx.AsyncClient, *, email: str, password: str) -> str:
    response = await client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _image_payload() -> bytes:
    image = Image.new("RGB", (160, 120), color=(20, 60, 200))
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


async def _capture_new(client: httpx.AsyncClient, headers: dict[str, str], collection_id: int):
    response = await client.post(
        f"/speed-capture/{collection_id}/new",
        files={"file": ("capture.png", _image_payload(), "image/png")},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_draft_numbers_do_not_repeat_after_deletion(
    app_with_db, db_session_factory, tmp_path
) -> None:
    email = "speed-capture@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {token}"}

            create = await client.post(
                "/collections", json={"name": "Inbox"}, headers=headers
            )
            assert create.status_code == 201
            collection_id = create.json()["id"]

            first = await _capture_new(client, headers, collection_id)
            second = await _capture_new(client, headers, collection_id)
            third = await _capture_new(client, headers, collection_id)
            assert first["item_name"] == "Draft 1"
            assert second["item_name"] == "Draft 2"
            assert third["item_name"] == "Draft 3"

            # Deleting an earlier draft must not free its number for reuse.
            delete = await client.delete(
                f"/collections/{collection_id}/items/{first['item_id']}",
                headers=headers,
            )
            assert delete.status_code == 200

            fourth = await _capture_new(client, headers, collection_id)
            assert fourth["item_name"] == "Draft 4"

            session_state = await client.get(
                f"/speed-capture/{collection_id}/session", headers=headers
            )
            assert session_state.status_code == 200
            payload = session_state.json()
            assert payload["draft_count"] == 3
            assert payload["total_images"] == 3

    with _temp_uploads_dir(tmp_path):
        asyncio.run(_flow())


def test_capture_add_image_appends_to_draft(app_with_db, db_session_factory, tmp_path) -> None:
    email = "speed-capture-add@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {token}"}

            create = await client.post(
                "/collections", json={"name": "Inbox"}, headers=headers
            )
            assert create.status_code == 201
            collection_id = create.json()["id"]

            draft = await _capture_new(client, headers, collection_id)
            item_id = draft["item_id"]

            add = await client.post(
                f"/speed-capture/{collection_id}/items/{item_id}/add",
                files={"file": ("more.png", _image_payload(), "image/png")},
                headers=headers,
            )
            assert add.status_code == 201
            assert add.json()["image_count"] == 2

    with _temp_uploads_dir(tmp_path):
        asyncio.run(_flow())

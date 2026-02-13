from __future__ import annotations

import asyncio

import httpx

from app.core.security import hash_password
from app.models.collection import Collection
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


def _get_collection(session_factory, collection_id: int) -> Collection | None:
    session = session_factory()
    try:
        return session.get(Collection, collection_id)
    finally:
        session.close()


async def _login(client: httpx.AsyncClient, *, email: str, password: str) -> str:
    response = await client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_collection_crud(app_with_db, db_session_factory) -> None:
    email = "owner@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)
    created: dict[str, int] = {}

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            create = await client.post(
                "/collections",
                json={"name": "  Vintage Cameras  ", "description": "   "},
                headers=headers,
            )
            assert create.status_code == 201
            created_payload = create.json()
            assert created_payload["name"] == "Vintage Cameras"
            assert created_payload["description"] is None
            assert created_payload["is_public"] is False
            created["id"] = created_payload["id"]

            listing = await client.get("/collections", headers=headers)
            assert listing.status_code == 200
            assert [collection["id"] for collection in listing.json()] == [created["id"]]

            detail = await client.get(f"/collections/{created['id']}", headers=headers)
            assert detail.status_code == 200
            assert detail.json()["name"] == "Vintage Cameras"

            update = await client.patch(
                f"/collections/{created['id']}",
                json={"name": " Updated ", "description": " Details ", "is_public": True},
                headers=headers,
            )
            assert update.status_code == 200
            updated_payload = update.json()
            assert updated_payload["name"] == "Updated"
            assert updated_payload["description"] == "Details"
            assert updated_payload["is_public"] is True

            delete = await client.delete(f"/collections/{created['id']}", headers=headers)
            assert delete.status_code == 200
            assert delete.json()["message"] == "Collection deleted"

            after_delete = await client.get(f"/collections/{created['id']}", headers=headers)
            assert after_delete.status_code == 404

    asyncio.run(_flow())
    assert _get_collection(db_session_factory, created["id"]) is None


def test_collections_require_auth(app_with_db) -> None:
    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            assert (await client.get("/collections")).status_code == 401
            assert (await client.post("/collections", json={"name": "No Auth"})).status_code == 401
            assert (await client.get("/collections/1")).status_code == 401
            assert (
                await client.patch("/collections/1", json={"name": "No Auth"})
            ).status_code == 401
            assert (await client.delete("/collections/1")).status_code == 401

    asyncio.run(_flow())


def test_collections_are_owner_scoped(app_with_db, db_session_factory) -> None:
    owner_email = "owner2@example.com"
    owner_password = "strongpass"
    other_email = "other@example.com"
    other_password = "strongpass"

    _create_user(db_session_factory, email=owner_email, password=owner_password, verified=True)
    _create_user(db_session_factory, email=other_email, password=other_password, verified=True)

    created: dict[str, int] = {}

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            owner_token = await _login(client, email=owner_email, password=owner_password)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}

            create = await client.post(
                "/collections",
                json={"name": "Owner Collection"},
                headers=owner_headers,
            )
            assert create.status_code == 201
            created["id"] = create.json()["id"]

            other_token = await _login(client, email=other_email, password=other_password)
            other_headers = {"Authorization": f"Bearer {other_token}"}

            other_list = await client.get("/collections", headers=other_headers)
            assert other_list.status_code == 200
            assert other_list.json() == []

            other_get = await client.get(f"/collections/{created['id']}", headers=other_headers)
            assert other_get.status_code == 404

            other_patch = await client.patch(
                f"/collections/{created['id']}",
                json={"name": "Hacked"},
                headers=other_headers,
            )
            assert other_patch.status_code == 404

            other_delete = await client.delete(
                f"/collections/{created['id']}", headers=other_headers
            )
            assert other_delete.status_code == 404

    asyncio.run(_flow())


def test_public_collections_endpoints(app_with_db, db_session_factory) -> None:
    email = "public@example.com"
    password = "strongpass"
    owner_id = _create_user(db_session_factory, email=email, password=password, verified=True)

    created: dict[str, int] = {}

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            public_create = await client.post(
                "/collections",
                json={"name": "Public Collection", "is_public": True},
                headers=headers,
            )
            assert public_create.status_code == 201
            created["public_id"] = public_create.json()["id"]

            private_create = await client.post(
                "/collections",
                json={"name": "Private Collection"},
                headers=headers,
            )
            assert private_create.status_code == 201
            created["private_id"] = private_create.json()["id"]

            public_list = await client.get("/public/collections")
            assert public_list.status_code == 200
            public_ids = {collection["id"] for collection in public_list.json()}
            assert created["public_id"] in public_ids
            assert created["private_id"] not in public_ids

            public_detail = await client.get(f"/public/collections/{created['public_id']}")
            assert public_detail.status_code == 200
            assert public_detail.json()["id"] == created["public_id"]
            assert public_detail.json()["owner_username"] == str(owner_id)

            private_detail = await client.get(f"/public/collections/{created['private_id']}")
            assert private_detail.status_code == 404

    asyncio.run(_flow())


def test_collection_validation_rejects_blank_name(app_with_db, db_session_factory) -> None:
    email = "validation@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            create = await client.post(
                "/collections",
                json={"name": "   "},
                headers=headers,
            )
            assert create.status_code == 422

            valid = await client.post(
                "/collections",
                json={"name": "Valid"},
                headers=headers,
            )
            assert valid.status_code == 201
            collection_id = valid.json()["id"]

            update = await client.patch(
                f"/collections/{collection_id}",
                json={"name": " "},
                headers=headers,
            )
            assert update.status_code == 422

    asyncio.run(_flow())

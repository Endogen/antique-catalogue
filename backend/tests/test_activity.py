from __future__ import annotations

import asyncio

import httpx

from app.core.security import hash_password
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
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


async def _login(client: httpx.AsyncClient, *, email: str, password: str) -> str:
    response = await client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_activity_requires_auth(app_with_db) -> None:
    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/activity")
            assert response.status_code == 401

    asyncio.run(_flow())


def test_activity_tracks_item_and_collection_actions(app_with_db, db_session_factory) -> None:
    email = "activity@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {token}"}

            create_collection = await client.post(
                "/collections",
                json={"name": "Cabinet"},
                headers=headers,
            )
            assert create_collection.status_code == 201
            collection_id = create_collection.json()["id"]

            create_item = await client.post(
                f"/collections/{collection_id}/items",
                json={"name": "Bronze Clock"},
                headers=headers,
            )
            assert create_item.status_code == 201
            item_id = create_item.json()["id"]

            update_item = await client.patch(
                f"/collections/{collection_id}/items/{item_id}",
                json={"name": "Bronze Clock Restored"},
                headers=headers,
            )
            assert update_item.status_code == 200

            update_collection = await client.patch(
                f"/collections/{collection_id}",
                json={"name": "Cabinet Updated"},
                headers=headers,
            )
            assert update_collection.status_code == 200

            activity = await client.get("/activity", headers=headers)
            assert activity.status_code == 200
            payload = activity.json()
            assert len(payload) == 4
            assert [entry["action_type"] for entry in payload] == [
                "collection.updated",
                "item.updated",
                "item.created",
                "collection.created",
            ]
            assert payload[0]["resource_type"] == "collection"
            assert payload[0]["resource_id"] == collection_id
            assert payload[0]["target_path"] == f"/collections/{collection_id}"
            assert payload[1]["resource_type"] == "item"
            assert payload[1]["resource_id"] == item_id
            assert payload[2]["target_path"] == f"/collections/{collection_id}/items/{item_id}"

            limited = await client.get("/activity", headers=headers, params={"limit": 2})
            assert limited.status_code == 200
            assert len(limited.json()) == 2

    asyncio.run(_flow())


def test_activity_keeps_latest_100_actions_per_user(app_with_db, db_session_factory) -> None:
    email = "activity-cap@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {token}"}

            create_collection = await client.post(
                "/collections",
                json={"name": "Cap Test"},
                headers=headers,
            )
            assert create_collection.status_code == 201
            collection_id = create_collection.json()["id"]

            for index in range(105):
                update_collection = await client.patch(
                    f"/collections/{collection_id}",
                    json={"description": f"Revision {index}"},
                    headers=headers,
                )
                assert update_collection.status_code == 200

            activity = await client.get("/activity", headers=headers, params={"limit": 100})
            assert activity.status_code == 200
            payload = activity.json()
            assert len(payload) == 100
            assert payload[0]["action_type"] == "collection.updated"
            assert all(entry["action_type"] == "collection.updated" for entry in payload)

    asyncio.run(_flow())

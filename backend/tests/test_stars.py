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


async def _create_collection(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    *,
    name: str,
    is_public: bool,
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
    name: str,
) -> int:
    response = await client.post(
        f"/collections/{collection_id}/items",
        json={"name": name},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_stars_require_auth(app_with_db) -> None:
    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            assert (await client.get("/stars/collections")).status_code == 401
            assert (await client.get("/stars/items")).status_code == 401
            assert (await client.get("/stars/collections/1")).status_code == 401
            assert (await client.post("/stars/collections/1")).status_code == 401
            assert (await client.post("/stars/collections/1/items/1")).status_code == 401

    asyncio.run(_flow())


def test_starring_updates_status_and_counts(app_with_db, db_session_factory) -> None:
    email = "starrer@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {token}"}

            collection_id = await _create_collection(
                client,
                headers,
                name="Studio Finds",
                is_public=False,
            )
            item_id = await _create_item(
                client,
                headers,
                collection_id,
                name="Polished Compass",
            )

            collection_detail = await client.get(f"/collections/{collection_id}", headers=headers)
            assert collection_detail.status_code == 200
            assert collection_detail.json()["star_count"] == 0

            item_detail = await client.get(
                f"/collections/{collection_id}/items/{item_id}",
                headers=headers,
            )
            assert item_detail.status_code == 200
            assert item_detail.json()["star_count"] == 0

            star_collection = await client.post(
                f"/stars/collections/{collection_id}", headers=headers
            )
            assert star_collection.status_code == 200
            assert star_collection.json() == {"starred": True, "star_count": 1}

            star_item = await client.post(
                f"/stars/collections/{collection_id}/items/{item_id}",
                headers=headers,
            )
            assert star_item.status_code == 200
            assert star_item.json() == {"starred": True, "star_count": 1}

            collection_status = await client.get(
                f"/stars/collections/{collection_id}", headers=headers
            )
            assert collection_status.status_code == 200
            assert collection_status.json() == {"starred": True, "star_count": 1}

            item_status = await client.get(
                f"/stars/collections/{collection_id}/items/{item_id}",
                headers=headers,
            )
            assert item_status.status_code == 200
            assert item_status.json() == {"starred": True, "star_count": 1}

            updated_collection = await client.get(f"/collections/{collection_id}", headers=headers)
            assert updated_collection.status_code == 200
            assert updated_collection.json()["star_count"] == 1

            updated_item = await client.get(
                f"/collections/{collection_id}/items/{item_id}",
                headers=headers,
            )
            assert updated_item.status_code == 200
            assert updated_item.json()["star_count"] == 1

            unstar_item = await client.delete(
                f"/stars/collections/{collection_id}/items/{item_id}",
                headers=headers,
            )
            assert unstar_item.status_code == 200
            assert unstar_item.json() == {"starred": False, "star_count": 0}

            unstar_collection = await client.delete(
                f"/stars/collections/{collection_id}",
                headers=headers,
            )
            assert unstar_collection.status_code == 200
            assert unstar_collection.json() == {"starred": False, "star_count": 0}

    asyncio.run(_flow())


def test_starring_public_content_logs_activity_for_actor_and_owner(
    app_with_db,
    db_session_factory,
) -> None:
    owner_email = "owner-stars@example.com"
    owner_password = "strongpass"
    viewer_email = "viewer-stars@example.com"
    viewer_password = "strongpass"
    _create_user(db_session_factory, email=owner_email, password=owner_password, verified=True)
    _create_user(db_session_factory, email=viewer_email, password=viewer_password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            owner_token = await _login(client, email=owner_email, password=owner_password)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}

            collection_id = await _create_collection(
                client,
                owner_headers,
                name="Public Cabinet",
                is_public=True,
            )
            item_id = await _create_item(
                client,
                owner_headers,
                collection_id,
                name="Bronze Dial",
            )

            viewer_token = await _login(client, email=viewer_email, password=viewer_password)
            viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

            star_collection = await client.post(
                f"/stars/collections/{collection_id}", headers=viewer_headers
            )
            assert star_collection.status_code == 200

            star_item = await client.post(
                f"/stars/collections/{collection_id}/items/{item_id}",
                headers=viewer_headers,
            )
            assert star_item.status_code == 200

            viewer_activity = await client.get("/activity", headers=viewer_headers)
            assert viewer_activity.status_code == 200
            viewer_payload = viewer_activity.json()
            assert [entry["action_type"] for entry in viewer_payload[:2]] == [
                "item.starred",
                "collection.starred",
            ]
            assert viewer_payload[0]["target_path"] == f"/explore/{collection_id}"
            assert viewer_payload[1]["target_path"] == f"/explore/{collection_id}"

            owner_activity = await client.get("/activity", headers=owner_headers)
            assert owner_activity.status_code == 200
            owner_payload = owner_activity.json()
            assert [entry["action_type"] for entry in owner_payload[:2]] == [
                "item.starred",
                "collection.starred",
            ]
            assert owner_payload[0]["target_path"] == (
                f"/collections/{collection_id}/items/{item_id}"
            )
            assert owner_payload[1]["target_path"] == f"/collections/{collection_id}"
            assert viewer_email in owner_payload[0]["summary"]
            assert viewer_email in owner_payload[1]["summary"]

    asyncio.run(_flow())


def test_starred_lists_are_searchable_and_skip_now_private_content(
    app_with_db,
    db_session_factory,
) -> None:
    owner_email = "owner-private-toggle@example.com"
    owner_password = "strongpass"
    viewer_email = "viewer-private-toggle@example.com"
    viewer_password = "strongpass"
    _create_user(db_session_factory, email=owner_email, password=owner_password, verified=True)
    _create_user(db_session_factory, email=viewer_email, password=viewer_password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            owner_token = await _login(client, email=owner_email, password=owner_password)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}

            public_collection_id = await _create_collection(
                client,
                owner_headers,
                name="Signal Instruments",
                is_public=True,
            )
            public_item_id = await _create_item(
                client,
                owner_headers,
                public_collection_id,
                name="Signal Lamp",
            )

            private_collection_id = await _create_collection(
                client,
                owner_headers,
                name="Private Cabinet",
                is_public=False,
            )
            private_item_id = await _create_item(
                client,
                owner_headers,
                private_collection_id,
                name="Secret Register",
            )

            viewer_token = await _login(client, email=viewer_email, password=viewer_password)
            viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

            assert (
                await client.post(
                    f"/stars/collections/{private_collection_id}",
                    headers=viewer_headers,
                )
            ).status_code == 404
            assert (
                await client.post(
                    f"/stars/collections/{private_collection_id}/items/{private_item_id}",
                    headers=viewer_headers,
                )
            ).status_code == 404

            assert (
                await client.post(
                    f"/stars/collections/{public_collection_id}",
                    headers=viewer_headers,
                )
            ).status_code == 200
            assert (
                await client.post(
                    f"/stars/collections/{public_collection_id}/items/{public_item_id}",
                    headers=viewer_headers,
                )
            ).status_code == 200

            starred_collections = await client.get("/stars/collections", headers=viewer_headers)
            assert starred_collections.status_code == 200
            collections_payload = starred_collections.json()
            assert len(collections_payload) == 1
            assert collections_payload[0]["id"] == public_collection_id
            assert collections_payload[0]["target_path"] == f"/explore/{public_collection_id}"
            assert collections_payload[0]["star_count"] == 1

            starred_items = await client.get("/stars/items", headers=viewer_headers)
            assert starred_items.status_code == 200
            items_payload = starred_items.json()
            assert len(items_payload) == 1
            assert items_payload[0]["id"] == public_item_id
            assert items_payload[0]["target_path"] == f"/explore/{public_collection_id}"
            assert items_payload[0]["star_count"] == 1

            searched_collections = await client.get(
                "/stars/collections",
                headers=viewer_headers,
                params={"q": "Signal"},
            )
            assert searched_collections.status_code == 200
            assert len(searched_collections.json()) == 1

            searched_items = await client.get(
                "/stars/items",
                headers=viewer_headers,
                params={"q": "Lamp"},
            )
            assert searched_items.status_code == 200
            assert len(searched_items.json()) == 1

            make_private = await client.patch(
                f"/collections/{public_collection_id}",
                json={"is_public": False},
                headers=owner_headers,
            )
            assert make_private.status_code == 200

            now_hidden_collections = await client.get("/stars/collections", headers=viewer_headers)
            assert now_hidden_collections.status_code == 200
            assert now_hidden_collections.json() == []

            now_hidden_items = await client.get("/stars/items", headers=viewer_headers)
            assert now_hidden_items.status_code == 200
            assert now_hidden_items.json() == []

    asyncio.run(_flow())

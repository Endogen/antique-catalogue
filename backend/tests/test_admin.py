from __future__ import annotations

import asyncio
from dataclasses import replace

import httpx

import app.api.admin as admin_api_module
from app.core.security import hash_password
from app.core.settings import settings as base_settings
from app.models.collection import Collection
from app.models.item import Item
from app.models.user import User


def _configure_admin_credentials(monkeypatch) -> None:
    monkeypatch.setattr(
        admin_api_module,
        "settings",
        replace(
            base_settings,
            admin_email="admin@example.com",
            admin_password="admin-secret",
        ),
    )


def _create_user(
    session_factory,
    *,
    email: str,
    password: str,
    verified: bool = True,
    active: bool = True,
) -> int:
    session = session_factory()
    try:
        user = User(
            email=email,
            password_hash=hash_password(password),
            is_verified=verified,
            is_active=active,
        )
        session.add(user)
        session.flush()
        user.username = str(user.id)
        session.commit()
        session.refresh(user)
        return user.id
    finally:
        session.close()


def _create_collection_with_items(
    session_factory,
    *,
    owner_id: int,
    collection_name: str,
    item_names: list[str],
) -> tuple[int, list[int]]:
    session = session_factory()
    try:
        collection = Collection(
            owner_id=owner_id,
            name=collection_name,
            description=None,
            is_public=True,
        )
        session.add(collection)
        session.flush()

        item_ids: list[int] = []
        for name in item_names:
            item = Item(
                collection_id=collection.id,
                name=name,
                notes=None,
                metadata_=None,
            )
            session.add(item)
            session.flush()
            item_ids.append(item.id)

        session.commit()
        return collection.id, item_ids
    finally:
        session.close()


def _set_item_draft(session_factory, item_id: int, *, is_draft: bool) -> None:
    session = session_factory()
    try:
        item = session.get(Item, item_id)
        if item is None:
            raise AssertionError(f"Item {item_id} was not found")
        item.is_draft = is_draft
        session.add(item)
        session.commit()
    finally:
        session.close()


async def _admin_headers(client: httpx.AsyncClient) -> dict[str, str]:
    login = await client.post(
        "/admin/login",
        json={"email": "admin@example.com", "password": "admin-secret"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_admin_can_list_users_and_lock_unlock(app_with_db, db_session_factory, monkeypatch) -> None:
    _configure_admin_credentials(monkeypatch)
    user_id = _create_user(
        db_session_factory,
        email="collector@example.com",
        password="strongpass",
        verified=True,
        active=True,
    )
    _create_collection_with_items(
        db_session_factory,
        owner_id=user_id,
        collection_name="Bronze Works",
        item_names=["Lamp"],
    )

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            headers = await _admin_headers(client)

            users = await client.get("/admin/users", headers=headers)
            assert users.status_code == 200
            payload = users.json()
            target = next((entry for entry in payload["items"] if entry["id"] == user_id), None)
            assert target is not None
            assert target["collection_count"] == 1
            assert target["item_count"] == 1
            assert target["is_active"] is True

            lock = await client.patch(
                f"/admin/users/{user_id}/lock",
                headers=headers,
                json={"locked": True},
            )
            assert lock.status_code == 200
            assert lock.json()["is_active"] is False

            locked_login = await client.post(
                "/auth/login",
                json={"email": "collector@example.com", "password": "strongpass"},
            )
            assert locked_login.status_code == 403
            assert locked_login.json()["detail"] == "Account locked"

            unlock = await client.patch(
                f"/admin/users/{user_id}/lock",
                headers=headers,
                json={"locked": False},
            )
            assert unlock.status_code == 200
            assert unlock.json()["is_active"] is True

            unlocked_login = await client.post(
                "/auth/login",
                json={"email": "collector@example.com", "password": "strongpass"},
            )
            assert unlocked_login.status_code == 200
            assert unlocked_login.json()["access_token"]

    asyncio.run(_flow())


def test_admin_delete_user_removes_owned_collections_and_items(
    app_with_db,
    db_session_factory,
    monkeypatch,
) -> None:
    _configure_admin_credentials(monkeypatch)
    user_id = _create_user(
        db_session_factory,
        email="remove-me@example.com",
        password="strongpass",
        verified=True,
        active=True,
    )
    collection_id, item_ids = _create_collection_with_items(
        db_session_factory,
        owner_id=user_id,
        collection_name="To Remove",
        item_names=["Item One", "Item Two"],
    )

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            headers = await _admin_headers(client)
            deleted = await client.delete(f"/admin/users/{user_id}", headers=headers)
            assert deleted.status_code == 200
            assert deleted.json()["message"] == "User deleted"

            relogin = await client.post(
                "/auth/login",
                json={"email": "remove-me@example.com", "password": "strongpass"},
            )
            assert relogin.status_code == 401
            assert relogin.json()["detail"] == "Invalid email or password"

    asyncio.run(_flow())

    session = db_session_factory()
    try:
        assert session.get(User, user_id) is None
        assert session.get(Collection, collection_id) is None
        for item_id in item_ids:
            assert session.get(Item, item_id) is None
    finally:
        session.close()


def test_admin_can_list_and_delete_items_and_collections(
    app_with_db,
    db_session_factory,
    monkeypatch,
) -> None:
    _configure_admin_credentials(monkeypatch)
    owner_id = _create_user(
        db_session_factory,
        email="owner@example.com",
        password="strongpass",
        verified=True,
        active=True,
    )
    collection_id, item_ids = _create_collection_with_items(
        db_session_factory,
        owner_id=owner_id,
        collection_name="Archive",
        item_names=["Alpha", "Beta"],
    )
    first_item_id, second_item_id = item_ids

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            headers = await _admin_headers(client)

            items = await client.get("/admin/items", headers=headers)
            assert items.status_code == 200
            returned_ids = {entry["id"] for entry in items.json()["items"]}
            assert first_item_id in returned_ids
            assert second_item_id in returned_ids

            delete_item = await client.delete(f"/admin/items/{first_item_id}", headers=headers)
            assert delete_item.status_code == 200
            assert delete_item.json()["message"] == "Item deleted"

            delete_collection = await client.delete(
                f"/admin/collections/{collection_id}",
                headers=headers,
            )
            assert delete_collection.status_code == 200
            assert delete_collection.json()["message"] == "Collection deleted"

    asyncio.run(_flow())

    session = db_session_factory()
    try:
        assert session.get(Item, first_item_id) is None
        assert session.get(Collection, collection_id) is None
        assert session.get(Item, second_item_id) is None
    finally:
        session.close()


def test_admin_featured_items_exclude_drafts(
    app_with_db,
    db_session_factory,
    monkeypatch,
) -> None:
    _configure_admin_credentials(monkeypatch)
    owner_id = _create_user(
        db_session_factory,
        email="featured-owner@example.com",
        password="strongpass",
        verified=True,
        active=True,
    )
    collection_id, item_ids = _create_collection_with_items(
        db_session_factory,
        owner_id=owner_id,
        collection_name="Featured Archive",
        item_names=["Published One", "Draft Candidate", "Published Two"],
    )
    published_one_id, draft_item_id, published_two_id = item_ids
    _set_item_draft(db_session_factory, draft_item_id, is_draft=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            headers = await _admin_headers(client)

            set_featured = await client.post(
                "/admin/featured",
                headers=headers,
                json={"collection_id": collection_id},
            )
            assert set_featured.status_code == 200

            admin_featured_items = await client.get("/admin/featured/items", headers=headers)
            assert admin_featured_items.status_code == 200
            admin_featured_ids = {item["id"] for item in admin_featured_items.json()}
            assert draft_item_id not in admin_featured_ids

            draft_selection = await client.post(
                "/admin/featured/items",
                headers=headers,
                json={"item_ids": [draft_item_id]},
            )
            assert draft_selection.status_code == 404
            assert (
                draft_selection.json()["detail"]
                == "One or more items could not be found in the featured collection"
            )

            valid_selection = await client.post(
                "/admin/featured/items",
                headers=headers,
                json={"item_ids": [published_one_id, published_two_id]},
            )
            assert valid_selection.status_code == 200

            public_featured_collection = await client.get("/public/collections/featured")
            assert public_featured_collection.status_code == 200
            assert public_featured_collection.json()["id"] == collection_id

            public_featured_items = await client.get("/public/collections/featured/items")
            assert public_featured_items.status_code == 200
            public_featured_ids = {item["id"] for item in public_featured_items.json()}
            assert public_featured_ids == {published_one_id, published_two_id}

    asyncio.run(_flow())

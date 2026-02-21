from __future__ import annotations

import asyncio

import httpx

from app.core.security import hash_password
from app.models.item import Item
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


async def _create_field(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    collection_id: int,
    payload: dict[str, object],
) -> int:
    response = await client.post(
        f"/collections/{collection_id}/fields",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


async def _create_item(
    client: httpx.AsyncClient,
    headers: dict[str, str],
    collection_id: int,
    payload: dict[str, object],
) -> dict[str, object]:
    response = await client.post(
        f"/collections/{collection_id}/items",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def _set_item_draft(session_factory, item_id: int, *, is_draft: bool) -> None:
    session = session_factory()
    try:
        item = session.get(Item, item_id)
        assert item is not None
        item.is_draft = is_draft
        session.add(item)
        session.commit()
    finally:
        session.close()


def test_item_crud_and_queries(app_with_db, db_session_factory) -> None:
    email = "items@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            collection_id = await _create_collection(client, headers, name="Antique Tools")

            await _create_field(
                client,
                headers,
                collection_id,
                {
                    "name": "Condition",
                    "field_type": "select",
                    "is_required": True,
                    "options": {"options": ["Excellent", "Good"]},
                },
            )
            await _create_field(
                client,
                headers,
                collection_id,
                {"name": "Year", "field_type": "number"},
            )

            item_one = await _create_item(
                client,
                headers,
                collection_id,
                {
                    "name": "  Brass Telescope ",
                    "notes": "  First item ",
                    "metadata": {
                        "Condition": " Excellent ",
                        "Year": 1900,
                    },
                },
            )
            assert item_one["name"] == "Brass Telescope"
            assert item_one["notes"] == "First item"
            assert item_one["metadata"]["Condition"] == "Excellent"
            assert item_one["metadata"]["Year"] == 1900

            item_two = await _create_item(
                client,
                headers,
                collection_id,
                {
                    "name": "Silver Watch",
                    "notes": "Needs polishing",
                    "metadata": {
                        "Condition": "Good",
                        "Year": 1920,
                    },
                },
            )

            listing = await client.get(
                f"/collections/{collection_id}/items",
                headers=headers,
            )
            assert listing.status_code == 200
            assert [item["id"] for item in listing.json()] == [
                item_two["id"],
                item_one["id"],
            ]

            search = await client.get(
                f"/collections/{collection_id}/items",
                headers=headers,
                params={"search": "polishing"},
            )
            assert search.status_code == 200
            assert [item["id"] for item in search.json()] == [item_two["id"]]

            filtered = await client.get(
                f"/collections/{collection_id}/items",
                headers=headers,
                params={"filter": "Condition=Excellent"},
            )
            assert filtered.status_code == 200
            assert [item["id"] for item in filtered.json()] == [item_one["id"]]

            sorted_by_name = await client.get(
                f"/collections/{collection_id}/items",
                headers=headers,
                params={"sort": "name"},
            )
            assert sorted_by_name.status_code == 200
            assert [item["id"] for item in sorted_by_name.json()] == [
                item_one["id"],
                item_two["id"],
            ]

            sorted_by_year = await client.get(
                f"/collections/{collection_id}/items",
                headers=headers,
                params={"sort": "-metadata:Year"},
            )
            assert sorted_by_year.status_code == 200
            assert [item["id"] for item in sorted_by_year.json()] == [
                item_two["id"],
                item_one["id"],
            ]

            paged = await client.get(
                f"/collections/{collection_id}/items",
                headers=headers,
                params={"offset": 1, "limit": 1},
            )
            assert paged.status_code == 200
            assert [item["id"] for item in paged.json()] == [item_one["id"]]

            detail = await client.get(
                f"/collections/{collection_id}/items/{item_one['id']}",
                headers=headers,
            )
            assert detail.status_code == 200
            assert detail.json()["id"] == item_one["id"]

            update = await client.patch(
                f"/collections/{collection_id}/items/{item_one['id']}",
                headers=headers,
                json={
                    "name": "Brass Telescope Updated",
                    "notes": "   ",
                    "metadata": {"Condition": "Good", "Year": 1901},
                },
            )
            assert update.status_code == 200
            updated_payload = update.json()
            assert updated_payload["name"] == "Brass Telescope Updated"
            assert updated_payload["notes"] is None
            assert updated_payload["metadata"]["Condition"] == "Good"
            assert updated_payload["metadata"]["Year"] == 1901

            delete = await client.delete(
                f"/collections/{collection_id}/items/{item_one['id']}",
                headers=headers,
            )
            assert delete.status_code == 200
            assert delete.json()["message"] == "Item deleted"

            after_delete = await client.get(
                f"/collections/{collection_id}/items/{item_one['id']}",
                headers=headers,
            )
            assert after_delete.status_code == 404

    asyncio.run(_flow())


def test_item_can_move_to_another_owned_collection(app_with_db, db_session_factory) -> None:
    email = "item-move@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            source_collection_id = await _create_collection(
                client,
                headers,
                name="Source Collection",
            )
            destination_collection_id = await _create_collection(
                client,
                headers,
                name="Destination Collection",
            )

            item = await _create_item(
                client,
                headers,
                source_collection_id,
                {"name": "Move Candidate"},
            )

            move_response = await client.patch(
                f"/collections/{source_collection_id}/items/{item['id']}",
                headers=headers,
                json={"collection_id": destination_collection_id},
            )
            assert move_response.status_code == 200
            assert move_response.json()["collection_id"] == destination_collection_id

            source_detail = await client.get(
                f"/collections/{source_collection_id}/items/{item['id']}",
                headers=headers,
            )
            assert source_detail.status_code == 404

            destination_detail = await client.get(
                f"/collections/{destination_collection_id}/items/{item['id']}",
                headers=headers,
            )
            assert destination_detail.status_code == 200
            assert destination_detail.json()["id"] == item["id"]

            source_listing = await client.get(
                f"/collections/{source_collection_id}/items",
                headers=headers,
            )
            assert source_listing.status_code == 200
            assert source_listing.json() == []

            destination_listing = await client.get(
                f"/collections/{destination_collection_id}/items",
                headers=headers,
            )
            assert destination_listing.status_code == 200
            assert [row["id"] for row in destination_listing.json()] == [item["id"]]

    asyncio.run(_flow())


def test_item_move_requires_owned_destination_collection(
    app_with_db, db_session_factory
) -> None:
    owner_email = "item-move-owner@example.com"
    owner_password = "strongpass"
    other_email = "item-move-other@example.com"
    other_password = "strongpass"
    _create_user(db_session_factory, email=owner_email, password=owner_password, verified=True)
    _create_user(db_session_factory, email=other_email, password=other_password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            owner_token = await _login(client, email=owner_email, password=owner_password)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}

            owner_collection_id = await _create_collection(
                client,
                owner_headers,
                name="Owner Source",
            )
            item = await _create_item(
                client,
                owner_headers,
                owner_collection_id,
                {"name": "Protected Move Candidate"},
            )

            other_token = await _login(client, email=other_email, password=other_password)
            other_headers = {"Authorization": f"Bearer {other_token}"}
            other_collection_id = await _create_collection(
                client,
                other_headers,
                name="Other Destination",
            )

            move_response = await client.patch(
                f"/collections/{owner_collection_id}/items/{item['id']}",
                headers=owner_headers,
                json={"collection_id": other_collection_id},
            )
            assert move_response.status_code == 404
            assert move_response.json()["detail"] == "Collection not found"

            owner_detail = await client.get(
                f"/collections/{owner_collection_id}/items/{item['id']}",
                headers=owner_headers,
            )
            assert owner_detail.status_code == 200
            assert owner_detail.json()["collection_id"] == owner_collection_id

    asyncio.run(_flow())


def test_items_require_auth(app_with_db) -> None:
    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            assert (await client.get("/collections/1/items")).status_code == 401
            assert (
                await client.post(
                    "/collections/1/items",
                    json={"name": "No Auth"},
                )
            ).status_code == 401
            assert (await client.get("/collections/1/items/1")).status_code == 401
            assert (
                await client.patch(
                    "/collections/1/items/1",
                    json={"name": "No Auth"},
                )
            ).status_code == 401
            assert (await client.delete("/collections/1/items/1")).status_code == 401

    asyncio.run(_flow())


def test_items_owner_scoped(app_with_db, db_session_factory) -> None:
    owner_email = "owner-items@example.com"
    owner_password = "strongpass"
    other_email = "other-items@example.com"
    other_password = "strongpass"

    _create_user(db_session_factory, email=owner_email, password=owner_password, verified=True)
    _create_user(db_session_factory, email=other_email, password=other_password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            owner_token = await _login(client, email=owner_email, password=owner_password)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}

            collection_id = await _create_collection(client, owner_headers, name="Owner Items")
            await _create_field(
                client,
                owner_headers,
                collection_id,
                {
                    "name": "Condition",
                    "field_type": "select",
                    "is_required": True,
                    "options": {"options": ["Excellent"]},
                },
            )
            item = await _create_item(
                client,
                owner_headers,
                collection_id,
                {
                    "name": "Owner Item",
                    "metadata": {"Condition": "Excellent"},
                },
            )

            other_token = await _login(client, email=other_email, password=other_password)
            other_headers = {"Authorization": f"Bearer {other_token}"}

            other_list = await client.get(
                f"/collections/{collection_id}/items",
                headers=other_headers,
            )
            assert other_list.status_code == 404

            other_create = await client.post(
                f"/collections/{collection_id}/items",
                json={"name": "Other Item"},
                headers=other_headers,
            )
            assert other_create.status_code == 404

            other_get = await client.get(
                f"/collections/{collection_id}/items/{item['id']}",
                headers=other_headers,
            )
            assert other_get.status_code == 404

            other_update = await client.patch(
                f"/collections/{collection_id}/items/{item['id']}",
                json={"name": "Hacked"},
                headers=other_headers,
            )
            assert other_update.status_code == 404

            other_delete = await client.delete(
                f"/collections/{collection_id}/items/{item['id']}",
                headers=other_headers,
            )
            assert other_delete.status_code == 404

    asyncio.run(_flow())


def test_public_items_endpoints(app_with_db, db_session_factory) -> None:
    email = "public-items@example.com"
    password = "strongpass"
    owner_id = _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            public_collection_id = await _create_collection(
                client,
                headers,
                name="Public Items",
                is_public=True,
            )
            private_collection_id = await _create_collection(
                client,
                headers,
                name="Private Items",
                is_public=False,
            )

            for collection_id in (public_collection_id, private_collection_id):
                await _create_field(
                    client,
                    headers,
                    collection_id,
                    {
                        "name": "Condition",
                        "field_type": "select",
                        "is_required": True,
                        "options": {"options": ["Excellent"]},
                    },
                )

            public_item = await _create_item(
                client,
                headers,
                public_collection_id,
                {
                    "name": "Public Item",
                    "metadata": {"Condition": "Excellent"},
                },
            )
            await _create_item(
                client,
                headers,
                private_collection_id,
                {
                    "name": "Private Item",
                    "metadata": {"Condition": "Excellent"},
                },
            )

            public_list = await client.get(
                f"/public/collections/{public_collection_id}/items",
            )
            assert public_list.status_code == 200
            assert [item["id"] for item in public_list.json()] == [public_item["id"]]

            private_list = await client.get(
                f"/public/collections/{private_collection_id}/items",
            )
            assert private_list.status_code == 404

            public_detail = await client.get(
                f"/public/collections/{public_collection_id}/items/{public_item['id']}",
            )
            assert public_detail.status_code == 200
            assert public_detail.json()["id"] == public_item["id"]
            assert public_detail.json()["owner_username"] == str(owner_id)

            private_detail = await client.get(
                f"/public/collections/{private_collection_id}/items/{public_item['id']}",
            )
            assert private_detail.status_code == 404

    asyncio.run(_flow())


def test_item_draft_visibility_and_promotion(app_with_db, db_session_factory) -> None:
    email = "draft-items@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            collection_id = await _create_collection(
                client,
                headers,
                name="Draft Visibility",
                is_public=True,
            )
            await _create_field(
                client,
                headers,
                collection_id,
                {
                    "name": "Condition",
                    "field_type": "select",
                    "is_required": True,
                    "options": {"options": ["Excellent"]},
                },
            )

            published_item = await _create_item(
                client,
                headers,
                collection_id,
                {
                    "name": "Published Item",
                    "metadata": {"Condition": "Excellent"},
                },
            )
            draft_item = await _create_item(
                client,
                headers,
                collection_id,
                {
                    "name": "Draft Item",
                    "metadata": {"Condition": "Excellent"},
                },
            )
            _set_item_draft(db_session_factory, int(draft_item["id"]), is_draft=True)

            owner_default = await client.get(
                f"/collections/{collection_id}/items",
                headers=headers,
            )
            assert owner_default.status_code == 200
            assert [row["id"] for row in owner_default.json()] == [published_item["id"]]

            owner_with_drafts = await client.get(
                f"/collections/{collection_id}/items?include_drafts=true",
                headers=headers,
            )
            assert owner_with_drafts.status_code == 200
            assert [row["id"] for row in owner_with_drafts.json()] == [
                draft_item["id"],
                published_item["id"],
            ]
            assert owner_with_drafts.json()[0]["is_draft"] is True

            public_list = await client.get(f"/public/collections/{collection_id}/items")
            assert public_list.status_code == 200
            assert [row["id"] for row in public_list.json()] == [published_item["id"]]

            public_draft = await client.get(
                f"/public/collections/{collection_id}/items/{draft_item['id']}",
            )
            assert public_draft.status_code == 404

            promote = await client.patch(
                f"/collections/{collection_id}/items/{draft_item['id']}",
                headers=headers,
                json={"name": "Published Draft"},
            )
            assert promote.status_code == 200
            assert promote.json()["is_draft"] is False

            public_after_promote = await client.get(
                f"/public/collections/{collection_id}/items/{draft_item['id']}",
            )
            assert public_after_promote.status_code == 200
            assert public_after_promote.json()["id"] == draft_item["id"]

    asyncio.run(_flow())


def test_item_validation_and_filter_errors(app_with_db, db_session_factory) -> None:
    email = "validation-items@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            collection_id = await _create_collection(client, headers, name="Validation Items")
            await _create_field(
                client,
                headers,
                collection_id,
                {
                    "name": "Condition",
                    "field_type": "select",
                    "is_required": True,
                    "options": {"options": ["Excellent", "Good"]},
                },
            )

            blank_name = await client.post(
                f"/collections/{collection_id}/items",
                headers=headers,
                json={"name": "   "},
            )
            assert blank_name.status_code == 422
            assert blank_name.json()["detail"] == "Validation error"

            missing_required = await client.post(
                f"/collections/{collection_id}/items",
                headers=headers,
                json={"name": "Missing Metadata"},
            )
            assert missing_required.status_code == 422
            missing_errors = missing_required.json()["errors"]
            assert {"field": "Condition", "message": "Field is required"} in missing_errors

            unknown_field = await client.post(
                f"/collections/{collection_id}/items",
                headers=headers,
                json={"name": "Unknown", "metadata": {"Unknown": "Value"}},
            )
            assert unknown_field.status_code == 422
            unknown_errors = unknown_field.json()["errors"]
            assert {"field": "Unknown", "message": "Unknown field"} in unknown_errors

            valid_item = await _create_item(
                client,
                headers,
                collection_id,
                {
                    "name": "Valid",
                    "metadata": {"Condition": "Excellent"},
                },
            )
            assert valid_item["id"]

            bad_filter = await client.get(
                f"/collections/{collection_id}/items",
                headers=headers,
                params={"filter": "BadFilter"},
            )
            assert bad_filter.status_code == 422
            assert bad_filter.json()["detail"] == "Filter must be in the format 'Field=Value'"

            unknown_filter = await client.get(
                f"/collections/{collection_id}/items",
                headers=headers,
                params={"filter": "Unknown=Value"},
            )
            assert unknown_filter.status_code == 422
            assert unknown_filter.json()["detail"] == "Unknown metadata field 'Unknown'"

            invalid_filter_value = await client.get(
                f"/collections/{collection_id}/items",
                headers=headers,
                params={"filter": "Condition=Bad"},
            )
            assert invalid_filter_value.status_code == 422
            assert invalid_filter_value.json()["detail"].startswith("Filter value must be one of:")

            invalid_sort = await client.get(
                f"/collections/{collection_id}/items",
                headers=headers,
                params={"sort": "bad"},
            )
            assert invalid_sort.status_code == 422
            assert (
                invalid_sort.json()["detail"]
                == "Sort must be 'name', 'created_at', or 'metadata:<field>'"
            )

    asyncio.run(_flow())

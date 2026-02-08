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


def test_field_crud_and_reorder(app_with_db, db_session_factory) -> None:
    email = "fields@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            collection = await client.post(
                "/collections",
                json={"name": "Cameras"},
                headers=headers,
            )
            assert collection.status_code == 201
            collection_id = collection.json()["id"]

            field_one = await client.post(
                f"/collections/{collection_id}/fields",
                json={
                    "name": "  Condition  ",
                    "field_type": "select",
                    "is_required": True,
                    "options": {"options": [" Excellent ", "Good"]},
                },
                headers=headers,
            )
            assert field_one.status_code == 201
            field_one_payload = field_one.json()
            field_one_id = field_one_payload["id"]
            assert field_one_payload["name"] == "Condition"
            assert field_one_payload["field_type"] == "select"
            assert field_one_payload["is_required"] is True
            assert field_one_payload["options"] == {"options": ["Excellent", "Good"]}
            assert field_one_payload["position"] == 1

            field_two = await client.post(
                f"/collections/{collection_id}/fields",
                json={"name": "Year", "field_type": "number"},
                headers=headers,
            )
            assert field_two.status_code == 201
            field_two_payload = field_two.json()
            field_two_id = field_two_payload["id"]
            assert field_two_payload["position"] == 2
            assert field_two_payload["options"] is None

            listing = await client.get(
                f"/collections/{collection_id}/fields",
                headers=headers,
            )
            assert listing.status_code == 200
            assert [field["id"] for field in listing.json()] == [field_one_id, field_two_id]

            update = await client.patch(
                f"/collections/{collection_id}/fields/{field_one_id}",
                json={"name": "Condition Updated", "field_type": "text", "is_required": False},
                headers=headers,
            )
            assert update.status_code == 200
            updated_payload = update.json()
            assert updated_payload["name"] == "Condition Updated"
            assert updated_payload["field_type"] == "text"
            assert updated_payload["is_required"] is False
            assert updated_payload["options"] is None

            reorder = await client.patch(
                f"/collections/{collection_id}/fields/reorder",
                json={"field_ids": [field_two_id, field_one_id]},
                headers=headers,
            )
            assert reorder.status_code == 200
            reordered_payload = reorder.json()
            assert [field["id"] for field in reordered_payload] == [field_two_id, field_one_id]
            assert [field["position"] for field in reordered_payload] == [1, 2]

            listing_after = await client.get(
                f"/collections/{collection_id}/fields",
                headers=headers,
            )
            assert listing_after.status_code == 200
            assert [field["id"] for field in listing_after.json()] == [
                field_two_id,
                field_one_id,
            ]

            delete = await client.delete(
                f"/collections/{collection_id}/fields/{field_one_id}",
                headers=headers,
            )
            assert delete.status_code == 200
            assert delete.json()["message"] == "Field deleted"

            listing_final = await client.get(
                f"/collections/{collection_id}/fields",
                headers=headers,
            )
            assert listing_final.status_code == 200
            assert [field["id"] for field in listing_final.json()] == [field_two_id]

    asyncio.run(_flow())


def test_field_validation_and_uniqueness(app_with_db, db_session_factory) -> None:
    email = "validation-fields@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            collection = await client.post(
                "/collections",
                json={"name": "Validation Collection"},
                headers=headers,
            )
            assert collection.status_code == 201
            collection_id = collection.json()["id"]

            field_one = await client.post(
                f"/collections/{collection_id}/fields",
                json={"name": "Condition", "field_type": "text"},
                headers=headers,
            )
            assert field_one.status_code == 201
            field_one_id = field_one.json()["id"]

            duplicate = await client.post(
                f"/collections/{collection_id}/fields",
                json={"name": "Condition", "field_type": "text"},
                headers=headers,
            )
            assert duplicate.status_code == 409

            field_two = await client.post(
                f"/collections/{collection_id}/fields",
                json={"name": "Era", "field_type": "number"},
                headers=headers,
            )
            assert field_two.status_code == 201
            field_two_id = field_two.json()["id"]

            update_duplicate = await client.patch(
                f"/collections/{collection_id}/fields/{field_two_id}",
                json={"name": "Condition"},
                headers=headers,
            )
            assert update_duplicate.status_code == 409

            blank_name = await client.post(
                f"/collections/{collection_id}/fields",
                json={"name": "   ", "field_type": "text"},
                headers=headers,
            )
            assert blank_name.status_code == 422

            invalid_type = await client.post(
                f"/collections/{collection_id}/fields",
                json={"name": "Invalid", "field_type": "invalid"},
                headers=headers,
            )
            assert invalid_type.status_code == 422

            select_missing_options = await client.post(
                f"/collections/{collection_id}/fields",
                json={"name": "Quality", "field_type": "select"},
                headers=headers,
            )
            assert select_missing_options.status_code == 422

            options_for_text = await client.post(
                f"/collections/{collection_id}/fields",
                json={"name": "Notes", "field_type": "text", "options": {"options": ["A"]}},
                headers=headers,
            )
            assert options_for_text.status_code == 422

            update_to_select_missing_options = await client.patch(
                f"/collections/{collection_id}/fields/{field_one_id}",
                json={"field_type": "select"},
                headers=headers,
            )
            assert update_to_select_missing_options.status_code == 422

            update_with_options_for_non_select = await client.patch(
                f"/collections/{collection_id}/fields/{field_two_id}",
                json={"options": {"options": ["A"]}},
                headers=headers,
            )
            assert update_with_options_for_non_select.status_code == 422

            reorder_missing = await client.patch(
                f"/collections/{collection_id}/fields/reorder",
                json={"field_ids": [field_one_id]},
                headers=headers,
            )
            assert reorder_missing.status_code == 422

            reorder_duplicate = await client.patch(
                f"/collections/{collection_id}/fields/reorder",
                json={"field_ids": [field_one_id, field_one_id]},
                headers=headers,
            )
            assert reorder_duplicate.status_code == 422

    asyncio.run(_flow())


def test_fields_require_auth(app_with_db) -> None:
    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            assert (await client.get("/collections/1/fields")).status_code == 401
            assert (
                await client.post(
                    "/collections/1/fields",
                    json={"name": "No Auth", "field_type": "text"},
                )
            ).status_code == 401
            assert (
                await client.patch(
                    "/collections/1/fields/reorder",
                    json={"field_ids": [1]},
                )
            ).status_code == 401
            assert (
                await client.patch(
                    "/collections/1/fields/1",
                    json={"name": "No Auth"},
                )
            ).status_code == 401
            assert (await client.delete("/collections/1/fields/1")).status_code == 401

    asyncio.run(_flow())


def test_fields_owner_scoped(app_with_db, db_session_factory) -> None:
    owner_email = "owner-fields@example.com"
    owner_password = "strongpass"
    other_email = "other-fields@example.com"
    other_password = "strongpass"

    _create_user(db_session_factory, email=owner_email, password=owner_password, verified=True)
    _create_user(db_session_factory, email=other_email, password=other_password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            owner_token = await _login(client, email=owner_email, password=owner_password)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}

            collection = await client.post(
                "/collections",
                json={"name": "Owner Collection"},
                headers=owner_headers,
            )
            assert collection.status_code == 201
            collection_id = collection.json()["id"]

            field = await client.post(
                f"/collections/{collection_id}/fields",
                json={"name": "Owner Field", "field_type": "text"},
                headers=owner_headers,
            )
            assert field.status_code == 201
            field_id = field.json()["id"]

            other_token = await _login(client, email=other_email, password=other_password)
            other_headers = {"Authorization": f"Bearer {other_token}"}

            other_list = await client.get(
                f"/collections/{collection_id}/fields",
                headers=other_headers,
            )
            assert other_list.status_code == 404

            other_create = await client.post(
                f"/collections/{collection_id}/fields",
                json={"name": "Other Field", "field_type": "text"},
                headers=other_headers,
            )
            assert other_create.status_code == 404

            other_reorder = await client.patch(
                f"/collections/{collection_id}/fields/reorder",
                json={"field_ids": [field_id]},
                headers=other_headers,
            )
            assert other_reorder.status_code == 404

            other_update = await client.patch(
                f"/collections/{collection_id}/fields/{field_id}",
                json={"name": "Hacked"},
                headers=other_headers,
            )
            assert other_update.status_code == 404

            other_delete = await client.delete(
                f"/collections/{collection_id}/fields/{field_id}",
                headers=other_headers,
            )
            assert other_delete.status_code == 404

    asyncio.run(_flow())

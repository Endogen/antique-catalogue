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


def test_schema_template_crud_search_and_collection_copy(app_with_db, db_session_factory) -> None:
    email = "template-owner@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            create_template = await client.post(
                "/schema-templates",
                json={
                    "name": "  Camera baseline  ",
                    "fields": [
                        {
                            "name": "  Condition  ",
                            "field_type": "select",
                            "is_required": True,
                            "options": {"options": ["Excellent", "Good"]},
                        },
                        {
                            "name": "Era",
                            "field_type": "text",
                            "is_private": True,
                        },
                    ],
                },
                headers=headers,
            )
            assert create_template.status_code == 201
            created_payload = create_template.json()
            template_id = created_payload["id"]
            assert created_payload["name"] == "Camera baseline"
            assert created_payload["field_count"] == 2
            assert [field["name"] for field in created_payload["fields"]] == [
                "Condition",
                "Era",
            ]

            list_templates = await client.get(
                "/schema-templates",
                headers=headers,
                params={"q": "camera"},
            )
            assert list_templates.status_code == 200
            list_payload = list_templates.json()
            assert len(list_payload) == 1
            assert list_payload[0]["id"] == template_id
            assert list_payload[0]["field_count"] == 2

            update_template = await client.patch(
                f"/schema-templates/{template_id}",
                json={
                    "name": "Camera baseline v2",
                    "fields": [
                        {
                            "name": "Condition",
                            "field_type": "text",
                            "is_required": True,
                        },
                        {
                            "name": "Acquired",
                            "field_type": "date",
                        },
                    ],
                },
                headers=headers,
            )
            assert update_template.status_code == 200
            updated_template = update_template.json()
            assert updated_template["name"] == "Camera baseline v2"
            assert [field["name"] for field in updated_template["fields"]] == [
                "Condition",
                "Acquired",
            ]

            copy_template = await client.post(
                f"/schema-templates/{template_id}/copy",
                headers=headers,
            )
            assert copy_template.status_code == 201
            copied_payload = copy_template.json()
            copied_template_id = copied_payload["id"]
            assert copied_template_id != template_id
            assert copied_payload["name"] == "Camera baseline v2 (Copy)"
            assert [field["name"] for field in copied_payload["fields"]] == [
                "Condition",
                "Acquired",
            ]

            copy_template_again = await client.post(
                f"/schema-templates/{template_id}/copy",
                headers=headers,
            )
            assert copy_template_again.status_code == 201
            assert copy_template_again.json()["name"] == "Camera baseline v2 (Copy 2)"

            duplicate_copy_name = await client.post(
                f"/schema-templates/{template_id}/copy",
                json={"name": "Camera baseline v2 (Copy)"},
                headers=headers,
            )
            assert duplicate_copy_name.status_code == 409

            create_collection = await client.post(
                "/collections",
                json={
                    "name": "Camera collection",
                    "schema_template_id": template_id,
                },
                headers=headers,
            )
            assert create_collection.status_code == 201
            collection_id = create_collection.json()["id"]

            fields_after_create = await client.get(
                f"/collections/{collection_id}/fields",
                headers=headers,
            )
            assert fields_after_create.status_code == 200
            created_fields_payload = fields_after_create.json()
            assert [field["name"] for field in created_fields_payload] == [
                "Condition",
                "Acquired",
            ]
            assert [field["field_type"] for field in created_fields_payload] == [
                "text",
                "date",
            ]

            adjust_template_again = await client.patch(
                f"/schema-templates/{template_id}",
                json={
                    "fields": [
                        {
                            "name": "Only on template",
                            "field_type": "number",
                        }
                    ]
                },
                headers=headers,
            )
            assert adjust_template_again.status_code == 200
            assert adjust_template_again.json()["field_count"] == 1

            fields_after_template_change = await client.get(
                f"/collections/{collection_id}/fields",
                headers=headers,
            )
            assert fields_after_template_change.status_code == 200
            unchanged_fields = fields_after_template_change.json()
            assert [field["name"] for field in unchanged_fields] == [
                "Condition",
                "Acquired",
            ]

            copied_template_after_update = await client.get(
                f"/schema-templates/{copied_template_id}",
                headers=headers,
            )
            assert copied_template_after_update.status_code == 200
            assert [field["name"] for field in copied_template_after_update.json()["fields"]] == [
                "Condition",
                "Acquired",
            ]

            delete_template = await client.delete(
                f"/schema-templates/{template_id}",
                headers=headers,
            )
            assert delete_template.status_code == 200
            assert delete_template.json()["message"] == "Schema template deleted"

            fetch_deleted = await client.get(
                f"/schema-templates/{template_id}",
                headers=headers,
            )
            assert fetch_deleted.status_code == 404

            create_with_deleted_template = await client.post(
                "/collections",
                json={"name": "Another", "schema_template_id": template_id},
                headers=headers,
            )
            assert create_with_deleted_template.status_code == 404

    asyncio.run(_flow())


def test_schema_template_field_crud_and_reorder(app_with_db, db_session_factory) -> None:
    email = "template-fields@example.com"
    password = "strongpass"
    _create_user(db_session_factory, email=email, password=password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            access_token = await _login(client, email=email, password=password)
            headers = {"Authorization": f"Bearer {access_token}"}

            create_template = await client.post(
                "/schema-templates",
                json={"name": "Template editor"},
                headers=headers,
            )
            assert create_template.status_code == 201
            template_id = create_template.json()["id"]

            create_field_one = await client.post(
                f"/schema-templates/{template_id}/fields",
                json={"name": "Condition", "field_type": "text"},
                headers=headers,
            )
            assert create_field_one.status_code == 201
            field_one_id = create_field_one.json()["id"]

            create_field_two = await client.post(
                f"/schema-templates/{template_id}/fields",
                json={"name": "Grade", "field_type": "number"},
                headers=headers,
            )
            assert create_field_two.status_code == 201
            field_two_id = create_field_two.json()["id"]

            reorder = await client.patch(
                f"/schema-templates/{template_id}/fields/reorder",
                json={"field_ids": [field_two_id, field_one_id]},
                headers=headers,
            )
            assert reorder.status_code == 200
            assert [field["id"] for field in reorder.json()] == [field_two_id, field_one_id]

            update_field = await client.patch(
                f"/schema-templates/{template_id}/fields/{field_two_id}",
                json={
                    "field_type": "select",
                    "options": {"options": ["1", "2", "3"]},
                },
                headers=headers,
            )
            assert update_field.status_code == 200
            assert update_field.json()["field_type"] == "select"

            delete_field = await client.delete(
                f"/schema-templates/{template_id}/fields/{field_one_id}",
                headers=headers,
            )
            assert delete_field.status_code == 200

            list_fields = await client.get(
                f"/schema-templates/{template_id}/fields",
                headers=headers,
            )
            assert list_fields.status_code == 200
            payload = list_fields.json()
            assert len(payload) == 1
            assert payload[0]["id"] == field_two_id

    asyncio.run(_flow())


def test_schema_templates_require_auth(app_with_db) -> None:
    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            assert (await client.get("/schema-templates")).status_code == 401
            assert (
                await client.post("/schema-templates", json={"name": "No Auth"})
            ).status_code == 401
            assert (await client.get("/schema-templates/1")).status_code == 401
            assert (
                await client.patch("/schema-templates/1", json={"name": "No Auth"})
            ).status_code == 401
            assert (await client.delete("/schema-templates/1")).status_code == 401
            assert (await client.post("/schema-templates/1/copy")).status_code == 401

            assert (await client.get("/schema-templates/1/fields")).status_code == 401
            assert (
                await client.post(
                    "/schema-templates/1/fields",
                    json={"name": "No Auth", "field_type": "text"},
                )
            ).status_code == 401
            assert (
                await client.patch(
                    "/schema-templates/1/fields/reorder",
                    json={"field_ids": [1]},
                )
            ).status_code == 401
            assert (
                await client.patch(
                    "/schema-templates/1/fields/1",
                    json={"name": "No Auth"},
                )
            ).status_code == 401
            assert (await client.delete("/schema-templates/1/fields/1")).status_code == 401

    asyncio.run(_flow())


def test_schema_templates_are_owner_scoped(app_with_db, db_session_factory) -> None:
    owner_email = "owner-template@example.com"
    owner_password = "strongpass"
    other_email = "other-template@example.com"
    other_password = "strongpass"

    _create_user(db_session_factory, email=owner_email, password=owner_password, verified=True)
    _create_user(db_session_factory, email=other_email, password=other_password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            owner_token = await _login(client, email=owner_email, password=owner_password)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}

            create_template = await client.post(
                "/schema-templates",
                json={"name": "Owner template"},
                headers=owner_headers,
            )
            assert create_template.status_code == 201
            template_id = create_template.json()["id"]

            other_token = await _login(client, email=other_email, password=other_password)
            other_headers = {"Authorization": f"Bearer {other_token}"}

            other_get = await client.get(f"/schema-templates/{template_id}", headers=other_headers)
            assert other_get.status_code == 404

            other_update = await client.patch(
                f"/schema-templates/{template_id}",
                json={"name": "Hacked"},
                headers=other_headers,
            )
            assert other_update.status_code == 404

            other_delete = await client.delete(
                f"/schema-templates/{template_id}",
                headers=other_headers,
            )
            assert other_delete.status_code == 404

            other_copy = await client.post(
                f"/schema-templates/{template_id}/copy",
                headers=other_headers,
            )
            assert other_copy.status_code == 404

            other_create_field = await client.post(
                f"/schema-templates/{template_id}/fields",
                json={"name": "Hacked", "field_type": "text"},
                headers=other_headers,
            )
            assert other_create_field.status_code == 404

            use_owner_template_for_collection = await client.post(
                "/collections",
                json={"name": "Other collection", "schema_template_id": template_id},
                headers=other_headers,
            )
            assert use_owner_template_for_collection.status_code == 404

    asyncio.run(_flow())

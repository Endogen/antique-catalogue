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


def test_profile_username_update_validation_and_uniqueness(
    app_with_db,
    db_session_factory,
) -> None:
    user_one_email = "profile-one@example.com"
    user_one_password = "strongpass"
    user_two_email = "profile-two@example.com"
    user_two_password = "strongpass"
    _create_user(
        db_session_factory,
        email=user_one_email,
        password=user_one_password,
        verified=True,
    )
    _create_user(
        db_session_factory,
        email=user_two_email,
        password=user_two_password,
        verified=True,
    )

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            token_one = await _login(client, email=user_one_email, password=user_one_password)
            headers_one = {"Authorization": f"Bearer {token_one}"}

            me_before = await client.get("/profiles/me", headers=headers_one)
            assert me_before.status_code == 200
            me_before_payload = me_before.json()
            assert me_before_payload["username"] == str(me_before_payload["id"])

            update_username = await client.patch(
                "/profiles/me",
                json={"username": "Collect_One"},
                headers=headers_one,
            )
            assert update_username.status_code == 200
            assert update_username.json()["username"] == "collect_one"

            me_after = await client.get("/auth/me", headers=headers_one)
            assert me_after.status_code == 200
            assert me_after.json()["username"] == "collect_one"

            numeric_only = await client.patch(
                "/profiles/me",
                json={"username": "999999"},
                headers=headers_one,
            )
            assert numeric_only.status_code == 422
            assert numeric_only.json()["detail"] == "Username cannot be only numbers"

            invalid_chars = await client.patch(
                "/profiles/me",
                json={"username": "bad.name"},
                headers=headers_one,
            )
            assert invalid_chars.status_code == 422
            assert (
                invalid_chars.json()["detail"]
                == "Username can only contain letters, numbers, hyphens, and underscores"
            )

            token_two = await _login(client, email=user_two_email, password=user_two_password)
            headers_two = {"Authorization": f"Bearer {token_two}"}
            update_two = await client.patch(
                "/profiles/me",
                json={"username": "shared_name"},
                headers=headers_two,
            )
            assert update_two.status_code == 200

            conflict = await client.patch(
                "/profiles/me",
                json={"username": "shared_name"},
                headers=headers_one,
            )
            assert conflict.status_code == 409
            assert conflict.json()["detail"] == "Username already taken"

            own_id_username = str(me_before_payload["id"])
            id_username = await client.patch(
                "/profiles/me",
                json={"username": own_id_username},
                headers=headers_one,
            )
            assert id_username.status_code == 200
            assert id_username.json()["username"] == own_id_username

    asyncio.run(_flow())


def test_public_profile_stats_and_rank(app_with_db, db_session_factory) -> None:
    owner_email = "profile-owner@example.com"
    owner_password = "strongpass"
    viewer_email = "profile-viewer@example.com"
    viewer_password = "strongpass"
    challenger_email = "profile-challenger@example.com"
    challenger_password = "strongpass"
    _create_user(db_session_factory, email=owner_email, password=owner_password, verified=True)
    _create_user(db_session_factory, email=viewer_email, password=viewer_password, verified=True)
    _create_user(
        db_session_factory,
        email=challenger_email,
        password=challenger_password,
        verified=True,
    )

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            owner_token = await _login(client, email=owner_email, password=owner_password)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}

            viewer_token = await _login(client, email=viewer_email, password=viewer_password)
            viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

            challenger_token = await _login(
                client,
                email=challenger_email,
                password=challenger_password,
            )
            challenger_headers = {"Authorization": f"Bearer {challenger_token}"}

            owner_profile = await client.patch(
                "/profiles/me",
                json={"username": "ownerhero"},
                headers=owner_headers,
            )
            assert owner_profile.status_code == 200

            viewer_profile = await client.patch(
                "/profiles/me",
                json={"username": "viewerhero"},
                headers=viewer_headers,
            )
            assert viewer_profile.status_code == 200

            challenger_profile = await client.patch(
                "/profiles/me",
                json={"username": "challenger"},
                headers=challenger_headers,
            )
            assert challenger_profile.status_code == 200

            owner_public_one = await _create_collection(
                client,
                owner_headers,
                name="Owner Public One",
                is_public=True,
            )
            owner_public_two = await _create_collection(
                client,
                owner_headers,
                name="Owner Public Two",
                is_public=True,
            )
            owner_private = await _create_collection(
                client,
                owner_headers,
                name="Owner Private",
                is_public=False,
            )

            owner_item_one = await _create_item(
                client,
                owner_headers,
                owner_public_one,
                name="Owner Item One",
            )
            await _create_item(
                client,
                owner_headers,
                owner_public_two,
                name="Owner Item Two",
            )
            await _create_item(
                client,
                owner_headers,
                owner_private,
                name="Owner Private Item",
            )

            challenger_public = await _create_collection(
                client,
                challenger_headers,
                name="Challenger Public",
                is_public=True,
            )
            challenger_item = await _create_item(
                client,
                challenger_headers,
                challenger_public,
                name="Challenger Item",
            )

            star_owner_collection = await client.post(
                f"/stars/collections/{owner_public_one}",
                headers=viewer_headers,
            )
            assert star_owner_collection.status_code == 200
            star_owner_item = await client.post(
                f"/stars/collections/{owner_public_one}/items/{owner_item_one}",
                headers=viewer_headers,
            )
            assert star_owner_item.status_code == 200

            star_challenger_item = await client.post(
                f"/stars/collections/{challenger_public}/items/{challenger_item}",
                headers=viewer_headers,
            )
            assert star_challenger_item.status_code == 200

            owner_self_star_collection = await client.post(
                f"/stars/collections/{owner_public_one}",
                headers=owner_headers,
            )
            assert owner_self_star_collection.status_code == 200
            owner_self_star_item = await client.post(
                f"/stars/collections/{owner_public_one}/items/{owner_item_one}",
                headers=owner_headers,
            )
            assert owner_self_star_item.status_code == 200

            public_owner_profile = await client.get("/profiles/ownerhero")
            assert public_owner_profile.status_code == 200
            owner_payload = public_owner_profile.json()
            assert owner_payload["username"] == "ownerhero"
            assert owner_payload["public_collection_count"] == 2
            assert owner_payload["public_item_count"] == 2
            assert owner_payload["earned_star_count"] == 2
            assert owner_payload["star_rank"] == 1

            public_challenger_profile = await client.get("/profiles/challenger")
            assert public_challenger_profile.status_code == 200
            challenger_payload = public_challenger_profile.json()
            assert challenger_payload["earned_star_count"] == 1
            assert challenger_payload["star_rank"] == 2

            owner_me_profile = await client.get("/profiles/me", headers=owner_headers)
            assert owner_me_profile.status_code == 200
            assert owner_me_profile.json()["username"] == "ownerhero"
            assert owner_me_profile.json()["earned_star_count"] == 2

            missing = await client.get("/profiles/does_not_exist")
            assert missing.status_code == 404
            assert missing.json()["detail"] == "Profile not found"

    asyncio.run(_flow())


def test_public_profile_collections_endpoint_returns_only_users_public_collections(
    app_with_db,
    db_session_factory,
) -> None:
    owner_email = "profile-collections-owner@example.com"
    owner_password = "strongpass"
    viewer_email = "profile-collections-viewer@example.com"
    viewer_password = "strongpass"
    other_email = "profile-collections-other@example.com"
    other_password = "strongpass"
    _create_user(db_session_factory, email=owner_email, password=owner_password, verified=True)
    _create_user(db_session_factory, email=viewer_email, password=viewer_password, verified=True)
    _create_user(db_session_factory, email=other_email, password=other_password, verified=True)

    async def _flow() -> None:
        transport = httpx.ASGITransport(app=app_with_db)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            owner_token = await _login(client, email=owner_email, password=owner_password)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}
            viewer_token = await _login(client, email=viewer_email, password=viewer_password)
            viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
            other_token = await _login(client, email=other_email, password=other_password)
            other_headers = {"Authorization": f"Bearer {other_token}"}

            owner_profile = await client.patch(
                "/profiles/me",
                json={"username": "ownerlist"},
                headers=owner_headers,
            )
            assert owner_profile.status_code == 200

            owner_public_one = await _create_collection(
                client,
                owner_headers,
                name="Owner Public A",
                is_public=True,
            )
            owner_public_two = await _create_collection(
                client,
                owner_headers,
                name="Owner Public B",
                is_public=True,
            )
            await _create_collection(
                client,
                owner_headers,
                name="Owner Private",
                is_public=False,
            )
            other_public = await _create_collection(
                client,
                other_headers,
                name="Other Public",
                is_public=True,
            )

            owner_item = await _create_item(
                client,
                owner_headers,
                owner_public_one,
                name="Owner Item",
            )
            star_owner = await client.post(
                f"/stars/collections/{owner_public_one}",
                headers=viewer_headers,
            )
            assert star_owner.status_code == 200

            collections_response = await client.get("/profiles/ownerlist/collections")
            assert collections_response.status_code == 200
            payload = collections_response.json()
            returned_ids = {row["id"] for row in payload}
            assert returned_ids == {owner_public_one, owner_public_two}
            assert all(row["is_public"] is True for row in payload)
            assert all(row["owner_username"] == "ownerlist" for row in payload)

            first = next(row for row in payload if row["id"] == owner_public_one)
            second = next(row for row in payload if row["id"] == owner_public_two)
            assert first["item_count"] == 1
            assert first["star_count"] == 1
            assert second["item_count"] == 0
            assert second["star_count"] == 0

            all_public = await client.get("/public/collections")
            assert all_public.status_code == 200
            all_public_ids = {row["id"] for row in all_public.json()}
            assert owner_public_one in all_public_ids
            assert owner_public_two in all_public_ids
            assert other_public in all_public_ids

            missing = await client.get("/profiles/not_real/collections")
            assert missing.status_code == 404
            assert missing.json()["detail"] == "Profile not found"

            item_detail = await client.get(
                f"/public/collections/{owner_public_one}/items/{owner_item}",
            )
            assert item_detail.status_code == 200

    asyncio.run(_flow())

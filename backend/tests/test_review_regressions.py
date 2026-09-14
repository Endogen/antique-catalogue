"""Regression tests for privacy, preservation, recovery, and capture boundaries."""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import httpx
from sqlalchemy import select

from app.models.email_token import EmailToken
from app.models.item import Item
from app.services.email import EmailDeliveryError
from app.services.uploads import item_upload_dir
from tests.test_images import _image_payload
from tests.test_items import _create_collection, _create_field, _create_item, _create_user, _login


def run_flow(app, factory, flow):
    uid = _create_user(factory, email="review@example.com", password="strongpass")

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            token = await _login(client, email="review@example.com", password="strongpass")
            await flow(client, {"Authorization": f"Bearer {token}"}, uid)

    asyncio.run(run())


async def upload(client, headers, iid):
    result = await client.post(
        f"/items/{iid}/images",
        headers=headers,
        files={"file": ("photo.png", _image_payload(), "image/png")},
    )
    assert result.status_code == 201
    return result.json()["id"]


def test_draft_photo_access_and_visibility_revalidation(app_with_db, db_session_factory):
    other_id = _create_user(db_session_factory, email="other@example.com", password="strongpass")

    async def flow(c, h, uid):
        cid = await _create_collection(c, h, is_public=True)
        r = await c.post(
            f"/speed-capture/{cid}/new",
            headers=h,
            files={"file": ("photo.png", _image_payload(), "image/png")},
        )
        assert r.status_code == 201
        iid, image = r.json()["item_id"], r.json()["image_id"]
        other = await _login(c, email="other@example.com", password="strongpass")
        assert other_id != uid
        for headers in ({}, {"Authorization": f"Bearer {other}"}):
            assert (await c.get(f"/items/{iid}/images", headers=headers)).status_code == 404
            for variant in ("thumb", "medium", "original"):
                assert (
                    await c.get(f"/images/{image}/{variant}.jpg", headers=headers)
                ).status_code == 404
        assert (await c.get(f"/images/{image}/original.jpg", headers=h)).status_code == 200
        assert (
            await c.patch(f"/collections/{cid}/items/{iid}", headers=h, json={"name": "Published"})
        ).status_code == 200
        public = await c.get(
            f"/images/{image}/thumb.jpg", headers={"Authorization": "Bearer expired"}
        )
        assert public.status_code == 200
        assert "immutable" not in public.headers["cache-control"]
        assert "no-cache" in public.headers["cache-control"]
        await c.patch(f"/collections/{cid}", headers=h, json={"is_public": False})
        assert (
            await c.get(
                f"/images/{image}/thumb.jpg", headers={"If-None-Match": public.headers["etag"]}
            )
        ).status_code == 404

    run_flow(app_with_db, db_session_factory, flow)


def test_rename_delete_and_edit_preserve_values(app_with_db, db_session_factory):
    async def flow(c, h, uid):
        cid = await _create_collection(c, h, is_public=True)
        fid = await _create_field(c, h, cid, {"name": "Maker", "field_type": "text"})
        iid = (await _create_item(c, h, cid, {"name": "Vase", "metadata": {"Maker": "Meissen"}}))[
            "id"
        ]
        assert (
            await c.patch(
                f"/collections/{cid}/fields/{fid}", headers=h, json={"name": "Manufacturer"}
            )
        ).status_code == 200
        item = (await c.get(f"/collections/{cid}/items/{iid}", headers=h)).json()
        assert item["metadata"] == {"Manufacturer": "Meissen"}
        assert (
            await c.patch(
                f"/collections/{cid}/items/{iid}",
                headers=h,
                json={"name": "Updated", "metadata": item["metadata"]},
            )
        ).status_code == 200
        invalid = await c.patch(
            f"/collections/{cid}/fields/{fid}", headers=h, json={"field_type": "number"}
        )
        assert invalid.status_code == 409
        assert (await c.delete(f"/collections/{cid}/fields/{fid}", headers=h)).status_code == 200
        saved = await c.patch(
            f"/collections/{cid}/items/{iid}",
            headers=h,
            json={"name": "Still here", "metadata": None},
        )
        assert saved.json()["preserved_metadata"][0]["value"] == "Meissen"
        await _create_field(c, h, cid, {"name": "Manufacturer", "field_type": "text"})
        public = (await c.get(f"/public/collections/{cid}/items/{iid}")).json()
        assert public["metadata"] is None
        assert "preserved_metadata" not in public

    run_flow(app_with_db, db_session_factory, flow)


def test_move_preserves_private_and_incompatible_values_and_requires_review(
    app_with_db, db_session_factory
):
    async def flow(c, h, uid):
        src = await _create_collection(c, h)
        dst = await _create_collection(c, h, name="Destination", is_public=True)
        for name, kind, private in [
            ("Seller", "text", True),
            ("Age", "text", False),
            ("Maker", "text", False),
        ]:
            await _create_field(
                c, h, src, {"name": name, "field_type": kind, "is_private": private}
            )
        for name, kind in [("Seller", "text"), ("Age", "number"), ("Maker", "text")]:
            await _create_field(c, h, dst, {"name": name, "field_type": kind})
        await _create_field(
            c, h, dst, {"name": "Reference", "field_type": "text", "is_required": True}
        )
        iid = (
            await _create_item(
                c,
                h,
                src,
                {
                    "name": "Vase",
                    "metadata": {
                        "Seller": "Private address",
                        "Age": "Victorian",
                        "Maker": "Meissen",
                    },
                },
            )
        )["id"]
        image = await upload(c, h, iid)
        preview = (
            await c.get(
                f"/collections/{src}/items/{iid}/move-preview",
                headers=h,
                params={"destination_collection_id": dst},
            )
        ).json()
        assert set(preview["preserved_fields"]) == {"Seller", "Age"}
        assert preview["missing_fields"] == ["Reference"]
        moved = await c.patch(
            f"/collections/{src}/items/{iid}",
            headers=h,
            json={"collection_id": dst, "name": "Vase"},
        )
        assert moved.status_code == 200
        assert moved.json()["metadata"] == {"Maker": "Meissen"}
        assert moved.json()["is_draft"]
        assert len(moved.json()["preserved_metadata"]) == 2
        assert (await c.get(f"/public/collections/{dst}/items/{iid}")).status_code == 404
        assert (await c.get(f"/images/{image}/thumb.jpg", headers=h)).status_code == 200
        assert (
            await c.patch(f"/collections/{dst}/items/{iid}", headers=h, json={"name": "Publish"})
        ).status_code == 422
        published = await c.patch(
            f"/collections/{dst}/items/{iid}",
            headers=h,
            json={"metadata": {"Maker": "Meissen", "Reference": "R-1"}},
        )
        assert published.status_code == 200 and not published.json()["is_draft"]
        public = (await c.get(f"/public/collections/{dst}/items/{iid}")).json()
        assert public["metadata"] == {"Maker": "Meissen", "Reference": "R-1"}
        assert "preserved_metadata" not in public

    run_flow(app_with_db, db_session_factory, flow)


def test_failed_move_is_retryable_without_losing_photos(app_with_db, db_session_factory):
    async def flow(c, h, uid):
        src = await _create_collection(c, h)
        dst = await _create_collection(c, h, name="Destination")
        iid = (await _create_item(c, h, src, {"name": "Vase"}))["id"]
        image = await upload(c, h, iid)
        with patch("app.services.uploads.shutil.copytree", side_effect=OSError("disk full")):
            failed = await c.patch(
                f"/collections/{src}/items/{iid}", headers=h, json={"collection_id": dst}
            )
        assert failed.status_code == 503
        assert not item_upload_dir(uid, dst, iid).exists()
        assert (await c.get(f"/collections/{src}/items/{iid}", headers=h)).status_code == 200
        assert (await c.get(f"/images/{image}/thumb.jpg", headers=h)).status_code == 200
        retried = await c.patch(
            f"/collections/{src}/items/{iid}", headers=h, json={"collection_id": dst}
        )
        assert retried.status_code == 200
        assert (await c.get(f"/images/{image}/thumb.jpg", headers=h)).status_code == 200

    run_flow(app_with_db, db_session_factory, flow)


def test_reset_revokes_sessions_and_all_outstanding_reset_tokens(app_with_db, db_session_factory):
    async def flow(c, h, uid):
        old_refresh = c.cookies.get("refresh_token")
        with db_session_factory() as db:
            for token in ("reset-one", "reset-two"):
                db.add(
                    EmailToken(
                        user_id=uid,
                        token=token,
                        token_type="reset",
                        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                    )
                )
            db.commit()
        assert (
            await c.post("/auth/reset", json={"token": "reset-one", "password": "replacementpass"})
        ).status_code == 200
        assert (await c.get("/auth/me", headers=h)).status_code == 401
        c.cookies.clear()
        c.cookies.set("refresh_token", old_refresh)
        assert (await c.post("/auth/refresh")).status_code == 401
        assert (
            await c.post("/auth/reset", json={"token": "reset-two", "password": "otherpassword"})
        ).status_code == 400
        token = await _login(c, email="review@example.com", password="replacementpass")
        assert (
            await c.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        ).status_code == 200

    run_flow(app_with_db, db_session_factory, flow)


def test_refresh_rotation_and_logout_revoke_copied_tokens(app_with_db, db_session_factory):
    async def flow(c, h, uid):
        original = c.cookies.get("refresh_token")
        assert (await c.post("/auth/refresh")).status_code == 200
        rotated = c.cookies.get("refresh_token")
        assert original != rotated
        c.cookies.clear()
        c.cookies.set("refresh_token", original)
        assert (await c.post("/auth/refresh")).status_code == 401
        c.cookies.clear()
        c.cookies.set("refresh_token", rotated)
        assert (await c.post("/auth/logout")).status_code == 200
        assert (await c.get("/auth/me", headers=h)).status_code == 401
        c.cookies.set("refresh_token", rotated)
        assert (await c.post("/auth/refresh")).status_code == 401

    run_flow(app_with_db, db_session_factory, flow)


def test_resend_verification_replaces_expired_token_and_allows_login(
    app_with_db, db_session_factory
):
    _create_user(
        db_session_factory, email="unverified@example.com", password="strongpass", verified=False
    )

    async def flow():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app_with_db), base_url="http://test"
        ) as c:
            tokens = []
            for _ in range(2):
                r = await c.post(
                    "/auth/resend-verification", json={"email": "unverified@example.com"}
                )
                assert r.status_code == 200
                with db_session_factory() as db:
                    tokens.append(
                        db.scalar(select(EmailToken.token).where(EmailToken.used_at.is_(None)))
                    )
            assert (await c.post("/auth/verify", json={"token": tokens[0]})).status_code == 400
            assert (await c.post("/auth/verify", json={"token": tokens[1]})).status_code == 200
            await _login(c, email="unverified@example.com", password="strongpass")

    asyncio.run(flow())


def test_delivery_failure_is_visible_and_resend_can_recover(app_with_db, db_session_factory):
    async def flow():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app_with_db), base_url="http://test"
        ) as c:
            with patch("app.services.email.send_email", side_effect=EmailDeliveryError("offline")):
                r = await c.post(
                    "/auth/register", json={"email": "mail@example.com", "password": "strongpass"}
                )
            assert r.status_code == 503
            # Registration now rolls back failed delivery, so retry can create the account.
            r = await c.post(
                "/auth/register", json={"email": "mail@example.com", "password": "strongpass"}
            )
            assert r.status_code == 201
            with patch("app.services.email.send_email", side_effect=EmailDeliveryError("offline")):
                failed_resend = await c.post(
                    "/auth/resend-verification", json={"email": "mail@example.com"}
                )
            assert failed_resend.status_code == 503
            r = await c.post("/auth/resend-verification", json={"email": "mail@example.com"})
            assert r.status_code == 200
            with db_session_factory() as db:
                token = db.scalar(select(EmailToken.token).where(EmailToken.used_at.is_(None)))
            assert (await c.post("/auth/verify", json={"token": token})).status_code == 200

    asyncio.run(flow())


def test_draft_only_pagination_finds_older_drafts(app_with_db, db_session_factory):
    async def flow(c, h, uid):
        cid = await _create_collection(c, h)
        now = datetime.now(timezone.utc)
        with db_session_factory() as db:
            db.add_all(
                [
                    Item(
                        collection_id=cid,
                        name=f"Draft {i}",
                        is_draft=True,
                        created_at=now - timedelta(days=1),
                    )
                    for i in range(105)
                ]
            )
            db.add_all(
                [Item(collection_id=cid, name=f"Finished {i}", created_at=now) for i in range(100)]
            )
            db.commit()
        first = await c.get(
            f"/collections/{cid}/items", headers=h, params={"drafts_only": True, "limit": 100}
        )
        second = await c.get(
            f"/collections/{cid}/items",
            headers=h,
            params={"drafts_only": True, "limit": 100, "offset": 100},
        )
        assert len(first.json()) == 100 and len(second.json()) == 5
        rows = first.json() + second.json()
        assert len({row["id"] for row in rows}) == 105
        assert all(row["is_draft"] for row in rows)

    run_flow(app_with_db, db_session_factory, flow)

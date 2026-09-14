import hashlib
import io
import json
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from sqlalchemy import select

from app.models.collection import Collection
from app.models.transfer import UploadSession
from tests.test_images import _image_payload
from tests.test_items import _create_collection, _create_field, _create_item, _create_user, _login
from tests.test_review_regressions import run_flow, upload


def test_archive_roundtrip_and_restore_retry(app_with_db, db_session_factory):
    async def flow(c, h, uid):
        cid = await _create_collection(c, h, is_public=True)
        await _create_field(c, h, cid, {"name": "Cost", "field_type": "number", "is_private": True})
        item = await _create_item(
            c, h, cid, {"name": "Vase", "metadata": {"Cost": 90}, "notes": "Private note"}
        )
        image = await upload(c, h, item["id"])
        original = await c.get(f"/images/{image}/original.jpg", headers=h)
        response = await c.get(f"/collections/{cid}/export", headers=h)
        assert response.status_code == 200
        payload = response.content
        assert "no-store" in response.headers["cache-control"]
        assert (await c.get(f"/collections/{cid}/export")).status_code == 401
        files = {"file": ("backup.zip", payload, "application/zip")}
        preview = await c.post("/archives/preview", headers=h, files=files)
        assert preview.status_code == 200, preview.text
        assert preview.json()["private_fields"] == 1
        data = {"digest": preview.json()["digest"], "request_id": str(uuid4()), "name": "Restored"}
        result = await c.post("/archives/restore", headers=h, files=files, data=data)
        assert result.status_code == 200, result.text
        restored = result.json()["collection_id"]
        assert restored != cid
        assert (await c.get(f"/collections/{restored}", headers=h)).json()["is_public"] is False
        saved = (await c.get(f"/collections/{restored}/items", headers=h)).json()[0]
        assert saved["metadata"] == {"Cost": 90}
        assert saved["notes"] == "Private note"
        assert saved["created_at"] == item["created_at"]
        saved_image = (await c.get(f"/items/{saved['id']}/images", headers=h)).json()[0]
        assert (
            await c.get(f"/images/{saved_image['id']}/original.jpg", headers=h)
        ).content == original.content
        assert (await c.get(f"/images/{saved_image['id']}/original.jpg")).status_code == 404
        assert (
            await c.post("/archives/restore", headers=h, files=files, data=data)
        ).json() == result.json()
        with db_session_factory() as db:
            assert len(db.scalars(select(Collection)).all()) == 2
        data["digest"] = "0" * 64
        assert (
            await c.post("/archives/restore", headers=h, files=files, data=data)
        ).status_code == 409

    run_flow(app_with_db, db_session_factory, flow)


@pytest.mark.parametrize("corruption", ["path", "checksum", "duplicate", "version"])
def test_archive_rejects_bad_contents(app_with_db, db_session_factory, corruption):
    async def flow(c, h, uid):
        cid = await _create_collection(c, h)
        iid = (await _create_item(c, h, cid, {"name": "Vase"}))["id"]
        await upload(c, h, iid)
        exported = await c.get(f"/collections/{cid}/export", headers=h)
        with ZipFile(io.BytesIO(exported.content)) as archive:
            entries = {name: archive.read(name) for name in archive.namelist()}
        manifest = json.loads(entries["manifest.json"])
        if corruption == "path":
            entries["../../escape"] = b"bad"
        if corruption == "checksum":
            manifest["items"][0]["photos"][0]["sha256"] = "0" * 64
        if corruption == "version":
            manifest["version"] = 99
        entries["manifest.json"] = json.dumps(manifest).encode()
        data = io.BytesIO()
        with ZipFile(data, "w", compression=ZIP_DEFLATED) as archive:
            for name, content in entries.items():
                archive.writestr(name, content)
            if corruption == "duplicate":
                with pytest.warns(UserWarning, match="Duplicate name"):
                    archive.writestr("manifest.json", entries["manifest.json"])
        result = await c.post(
            "/archives/preview", headers=h, files={"file": ("bad.zip", data.getvalue())}
        )
        assert result.status_code == 422
        with db_session_factory() as db:
            assert len(db.scalars(select(Collection)).all()) == 1

    run_flow(app_with_db, db_session_factory, flow)


def test_upload_resume_and_completion_are_idempotent(app_with_db, db_session_factory):
    _create_user(db_session_factory, email="other@example.com", password="strongpass")

    async def flow(c, h, uid):
        cid = await _create_collection(c, h, is_public=True)
        photo = _image_payload()
        request = {
            "id": str(uuid4()),
            "filename": "photo.png",
            "size": len(photo),
            "target": {"mode": "capture-new", "collection_id": cid},
        }
        started = await c.post("/uploads", headers=h, json=request)
        assert started.status_code == 200, started.text
        endpoint = f"/uploads/{request['id']}"
        other = {
            "Authorization": "Bearer "
            + await _login(c, email="other@example.com", password="strongpass")
        }
        assert (await c.get(endpoint, headers=other)).status_code == 404
        assert (
            await c.put(endpoint + "?offset=0", headers=other, content=photo)
        ).status_code == 404
        assert (await c.post(endpoint + "/complete", headers=h)).status_code == 409
        half = len(photo) // 2
        assert (await c.put(endpoint + "?offset=0", headers=h, content=photo[:half])).json()[
            "received"
        ] == half
        assert (await c.put(endpoint + "?offset=0", headers=h, content=photo[:half])).json()[
            "received"
        ] == half
        assert (await c.post("/uploads", headers=h, json=request)).json()["received"] == half
        assert (await c.put(endpoint + "?offset=0", headers=h, content=b"wrong")).status_code == 409
        assert (await c.put(endpoint + f"?offset={half}", headers=h, content=photo[half:])).json()[
            "received"
        ] == len(photo)
        complete = await c.post(endpoint + "/complete", headers=h)
        assert complete.status_code == 200, complete.text
        result = complete.json()["result"]
        assert (await c.post(endpoint + "/complete", headers=h)).json() == complete.json()
        assert (await c.post("/uploads", headers=h, json=request)).json() == complete.json()
        assert (await c.get(f"/images/{result['image_id']}/thumb.jpg")).status_code == 404
        images = (await c.get(f"/items/{result['item_id']}/images", headers=h)).json()
        assert len(images) == 1
        with db_session_factory() as db:
            assert db.get(UploadSession, request["id"]).data == b""

    run_flow(app_with_db, db_session_factory, flow)


def test_upload_limits_and_invalid_photo_create_no_items(app_with_db, db_session_factory):
    async def flow(c, h, uid):
        cid = await _create_collection(c, h)
        request = {
            "id": str(uuid4()),
            "filename": "bad.png",
            "size": 4,
            "target": {"mode": "capture-new", "collection_id": cid},
        }
        assert (
            await c.post("/uploads", headers=h, json={**request, "size": 11 * 1024 * 1024})
        ).status_code == 422
        await c.post("/uploads", headers=h, json=request)
        endpoint = f"/uploads/{request['id']}"
        assert (
            await c.put(endpoint + "?offset=0", headers=h, content=b"x" * (1024 * 1024 + 1))
        ).status_code == 413
        await c.put(endpoint + "?offset=0", headers=h, content=b"nope")
        assert (await c.post(endpoint + "/complete", headers=h)).status_code == 422
        assert (
            await c.get(f"/collections/{cid}/items?include_drafts=true", headers=h)
        ).json() == []
        assert (await c.delete(endpoint, headers=h)).status_code == 200
        assert (await c.get(endpoint, headers=h)).status_code == 404

    run_flow(app_with_db, db_session_factory, flow)


def test_restore_storage_failure_rolls_back_and_can_retry(app_with_db, db_session_factory):
    from unittest.mock import patch

    from app.core.settings import settings

    async def flow(c, h, uid):
        cid = await _create_collection(c, h)
        iid = (await _create_item(c, h, cid, {"name": "Vase"}))["id"]
        await upload(c, h, iid)
        exported = await c.get(f"/collections/{cid}/export", headers=h)
        files = {"file": ("backup.zip", exported.content)}
        data = {
            "digest": hashlib.sha256(exported.content).hexdigest(),
            "request_id": str(uuid4()),
            "name": "Retry",
        }
        with patch("app.api.archives.save_image_variants", side_effect=OSError("Disk unavailable")):
            with pytest.raises(OSError):
                await c.post("/archives/restore", headers=h, files=files, data=data)
        with db_session_factory() as db:
            assert len(db.scalars(select(Collection)).all()) == 1
        assert not (settings.uploads_dir / str(uid) / str(cid + 1)).exists()
        assert (
            await c.post("/archives/restore", headers=h, files=files, data=data)
        ).status_code == 200

    run_flow(app_with_db, db_session_factory, flow)


@pytest.mark.parametrize("mode", ["item", "capture-add"])
def test_resume_upload_to_existing_item(app_with_db, db_session_factory, mode):
    async def flow(c, h, uid):
        cid = await _create_collection(c, h)
        photo = _image_payload()
        capture = await c.post(
            f"/speed-capture/{cid}/new", headers=h, files={"file": ("first.png", photo)}
        )
        iid = capture.json()["item_id"]
        target = {"mode": mode, "item_id": iid, "collection_id": cid}
        key = str(uuid4())
        assert (
            await c.post(
                "/uploads",
                headers=h,
                json={"id": key, "filename": "second.png", "size": len(photo), "target": target},
            )
        ).status_code == 200
        await c.put(f"/uploads/{key}?offset=0", headers=h, content=photo)
        result = await c.post(f"/uploads/{key}/complete", headers=h)
        assert result.status_code == 200, result.text
        assert result.json()["result"]["image_count"] == 2
        assert (await c.post(f"/uploads/{key}/complete", headers=h)).json() == result.json()

    run_flow(app_with_db, db_session_factory, flow)

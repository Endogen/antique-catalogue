"""Regression coverage for the September codebase review."""

import io
import json
from unittest.mock import patch
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from sqlalchemy import select

from app.models.collection import Collection
from app.models.item import Item
from tests.test_items import _create_collection, _create_field, _create_item
from tests.test_review_regressions import run_flow, upload


@pytest.mark.parametrize("literal", ["1e309", "-1e309", "NaN"])
def test_nonfinite_metadata_is_rejected_on_create_and_update(
    app_with_db, db_session_factory, literal
):
    async def flow(c, h, uid):
        cid = await _create_collection(c, h)
        await _create_field(c, h, cid, {"name": "Cost", "field_type": "number"})
        payload = '{"name":"Vase","metadata":{"Cost":' + literal + "}}"
        response = await c.post(
            f"/collections/{cid}/items",
            headers={**h, "Content-Type": "application/json"},
            content=payload,
        )
        assert response.status_code == 422, response.text
        with db_session_factory() as db:
            assert db.scalars(select(Item)).all() == []
        item = await _create_item(c, h, cid, {"name": "Vase", "metadata": {"Cost": 9.5}})
        response = await c.patch(
            f"/collections/{cid}/items/{item['id']}",
            headers={**h, "Content-Type": "application/json"},
            content=payload,
        )
        assert response.status_code == 422, response.text
        assert (await c.get(f"/collections/{cid}/items/{item['id']}", headers=h)).json()[
            "metadata"
        ] == {"Cost": 9.5}

    run_flow(app_with_db, db_session_factory, flow)


def test_name_limits_and_legacy_archive_roundtrip(app_with_db, db_session_factory):
    async def flow(c, h, uid):
        long_name = "長" * 201
        assert (
            await c.post("/collections", headers=h, json={"name": long_name})
        ).status_code == 422
        cid = await _create_collection(c, h)
        assert (
            await c.patch(f"/collections/{cid}", headers=h, json={"name": long_name})
        ).status_code == 422
        assert (
            await c.post(f"/collections/{cid}/items", headers=h, json={"name": long_name})
        ).status_code == 422
        item = await _create_item(c, h, cid, {"name": "A" * 200})
        assert (
            await c.patch(
                f"/collections/{cid}/items/{item['id']}", headers=h, json={"name": long_name}
            )
        ).status_code == 422
        # Simulate names accepted by releases predating the API length check.
        with db_session_factory() as db:
            db.get(Collection, cid).name = long_name
            db.get(Item, item["id"]).name = long_name
            db.commit()
        exported = await c.get(f"/collections/{cid}/export", headers=h)
        assert exported.status_code == 200, exported.text
        files = {"file": ("backup.zip", exported.content)}
        preview = await c.post("/archives/preview", headers=h, files=files)
        assert preview.status_code == 200
        data = {"digest": preview.json()["digest"], "name": long_name, "request_id": str(uuid4())}
        result = await c.post("/archives/restore", headers=h, files=files, data=data)
        assert result.status_code == 200, result.text
        restored = result.json()["collection_id"]
        assert (await c.get(f"/collections/{restored}", headers=h)).json()["name"] == long_name
        assert (await c.get(f"/collections/{restored}/items", headers=h)).json()[0][
            "name"
        ] == long_name
        data.update(name="B" * 201, request_id=str(uuid4()))
        assert (
            await c.post("/archives/restore", headers=h, files=files, data=data)
        ).status_code == 422

    run_flow(app_with_db, db_session_factory, flow)


@pytest.mark.parametrize("kind", ["metadata", "preserved", "corrupt-image", "oversized-image"])
def test_archive_rejects_invalid_values_and_images(app_with_db, db_session_factory, kind):
    async def flow(c, h, uid):
        cid = await _create_collection(c, h)
        item = await _create_item(c, h, cid, {"name": "Vase"})
        await upload(c, h, item["id"])
        exported = await c.get(f"/collections/{cid}/export", headers=h)
        with ZipFile(io.BytesIO(exported.content)) as archive:
            entries = {name: archive.read(name) for name in archive.namelist()}
        manifest = json.loads(entries["manifest.json"])
        record = manifest["items"][0]
        if kind == "metadata":
            record["metadata"] = {"Cost": {"nested": [float("inf")]}}
        elif kind == "preserved":
            record["preserved_metadata"] = [
                {"name": "Cost", "value": [float("nan")], "reason": "Old field"}
            ]
        elif kind == "corrupt-image":
            import hashlib

            photo = record["photos"][0]
            entries[photo["path"]] = b"not an image"
            photo["sha256"] = hashlib.sha256(entries[photo["path"]]).hexdigest()
        entries["manifest.json"] = json.dumps(manifest).encode()
        data = io.BytesIO()
        with ZipFile(data, "w", compression=ZIP_DEFLATED) as archive:
            for name, content in entries.items():
                archive.writestr(name, content)
        # A lower cap reproduces an oversized decoded image without allocating one.
        cap = 1 if kind == "oversized-image" else 80_000_000
        with patch("app.services.image_processing.MAX_IMAGE_PIXELS", cap):
            response = await c.post(
                "/archives/preview", headers=h, files={"file": ("bad.zip", data.getvalue())}
            )
            assert response.status_code == 422, response.text
            response = await c.post(
                "/archives/restore",
                headers=h,
                files={"file": ("bad.zip", data.getvalue())},
                data={"digest": "0" * 64, "request_id": str(uuid4()), "name": "Invalid"},
            )
            assert response.status_code == 422, response.text
        with db_session_factory() as db:
            assert len(db.scalars(select(Collection)).all()) == 1

    run_flow(app_with_db, db_session_factory, flow)


def test_archive_preview_decodes_without_encoding(app_with_db, db_session_factory):
    async def flow(c, h, uid):
        cid = await _create_collection(c, h)
        item = await _create_item(c, h, cid, {"name": "Vase"})
        await upload(c, h, item["id"])
        exported = await c.get(f"/collections/{cid}/export", headers=h)
        with patch("app.services.image_processing._encode_jpeg", side_effect=AssertionError):
            response = await c.post(
                "/archives/preview", headers=h, files={"file": ("backup.zip", exported.content)}
            )
            assert response.status_code == 200, response.text
            assert response.json()["photos"] == 1

    run_flow(app_with_db, db_session_factory, flow)

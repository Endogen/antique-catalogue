from __future__ import annotations

from io import BytesIO

import pytest

try:
    from PIL import Image
except ModuleNotFoundError:  # pragma: no cover - optional dependency in tests
    Image = None
    PIL_AVAILABLE = False
else:
    PIL_AVAILABLE = True

from app.core.settings import get_settings
from app.services.image_processing import (
    MAX_IMAGE_PIXELS,
    ImageProcessingError,
    VARIANT_NAMES,
    build_variant_filename,
    generate_image_variants,
    variant_max_sizes,
)

pytestmark = pytest.mark.skipif(not PIL_AVAILABLE, reason="Pillow is required")


def _photo(width: int, height: int) -> bytes:
    # Detailed rather than a flat fill: a uniform image compresses to the same
    # size at any quality, which would make the quality assertions meaningless.
    buffer = BytesIO()
    Image.effect_noise((width, height), 64).convert("RGB").save(
        buffer, format="JPEG", quality=95
    )
    return buffer.getvalue()


def _size(payload: bytes) -> tuple[int, int]:
    with Image.open(BytesIO(payload)) as image:
        return image.size


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_every_variant_is_produced_and_servable():
    variants = generate_image_variants(_photo(4000, 3000)).as_dict()
    assert set(variants) == set(VARIANT_NAMES)
    for name in VARIANT_NAMES:
        # A variant is only reachable if it also has a filename.
        assert build_variant_filename(1, name).endswith(f"_{name}.jpg")


def test_large_sits_between_medium_and_the_full_size_original():
    variants = generate_image_variants(_photo(4000, 3000)).as_dict()

    assert _size(variants["original"]) == (4000, 3000)
    assert max(_size(variants["large"])) == 1600
    assert max(_size(variants["medium"])) == 800
    assert max(_size(variants["thumb"])) == 200
    # The lightbox variant must be a real saving over the original it replaced.
    assert len(variants["large"]) < len(variants["original"]) / 2


def test_variants_are_never_upscaled_past_the_source():
    variants = generate_image_variants(_photo(500, 400)).as_dict()

    assert _size(variants["original"]) == (500, 400)
    assert _size(variants["large"]) == (500, 400)
    assert _size(variants["medium"]) == (500, 400)
    assert max(_size(variants["thumb"])) == 200


def test_sizes_and_quality_follow_the_environment(monkeypatch):
    # One source for both runs, so only the setting differs.
    source = _photo(2400, 1800)

    monkeypatch.setenv("IMAGE_LARGE_MAX_SIZE", "1200")
    monkeypatch.setenv("IMAGE_ORIGINAL_MAX_SIZE", "2000")
    monkeypatch.setenv("IMAGE_JPEG_QUALITY", "40")
    get_settings.cache_clear()

    assert variant_max_sizes()["large"] == 1200
    variants = generate_image_variants(source).as_dict()
    assert max(_size(variants["original"])) == 2000
    assert max(_size(variants["large"])) == 1200

    monkeypatch.setenv("IMAGE_JPEG_QUALITY", "95")
    get_settings.cache_clear()
    higher_quality = generate_image_variants(source).as_dict()
    assert len(higher_quality["large"]) > len(variants["large"])


def test_original_is_uncapped_by_default():
    assert variant_max_sizes()["original"] is None


def test_decode_pixel_cap_is_applied():
    # The cap must be installed on Pillow at import time, so every decode path
    # (direct upload, speed capture, resumable upload, archive restore) is bounded.
    assert Image.MAX_IMAGE_PIXELS == MAX_IMAGE_PIXELS


def test_oversized_images_are_rejected(monkeypatch):
    # Lower the cap to a value the normal test photo exceeds, then confirm the
    # bomb is rejected with a clear error instead of decoding or a generic 500.
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1000)
    with pytest.raises(ImageProcessingError, match="dimensions are too large"):
        generate_image_variants(_photo(4000, 3000))


@pytest.mark.parametrize("limit", [1024, 12 * 1024 * 1024])
def test_direct_and_resumable_uploads_respect_the_configured_limit(monkeypatch, limit):
    from uuid import uuid4

    from fastapi import HTTPException, UploadFile
    from pydantic import ValidationError

    from app.api.images import _read_upload as read_item
    from app.api.resumable import Start
    from app.api.speed_capture import _read_upload as read_capture

    monkeypatch.setenv("MAX_IMAGE_BYTES", str(limit))
    get_settings.cache_clear()
    payload = b"x" * limit
    for read in (read_item, read_capture):
        assert read(UploadFile(file=BytesIO(payload))) == payload
        with pytest.raises(HTTPException) as error:
            read(UploadFile(file=BytesIO(payload + b"x")))
        assert error.value.status_code == 413
    request = {"id": uuid4(), "target": {"mode": "capture-new", "collection_id": 1},
               "filename": "photo.jpg", "size": limit}
    assert Start.model_validate(request).size == limit
    with pytest.raises(ValidationError):
        Start.model_validate({**request, "size": limit + 1})

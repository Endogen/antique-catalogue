from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Mapping

from PIL import Image, ImageOps, UnidentifiedImageError

JPEG_QUALITY = 85
MEDIUM_MAX_SIZE = 800
THUMB_MAX_SIZE = 200
VARIANT_SPECS: dict[str, int | None] = {
    "original": None,
    "medium": MEDIUM_MAX_SIZE,
    "thumb": THUMB_MAX_SIZE,
}


class ImageProcessingError(ValueError):
    pass


@dataclass(frozen=True)
class ProcessedImageVariants:
    original: bytes
    medium: bytes
    thumb: bytes

    def as_dict(self) -> dict[str, bytes]:
        return {
            "original": self.original,
            "medium": self.medium,
            "thumb": self.thumb,
        }


def _resample_filter():
    return getattr(Image, "Resampling", Image).LANCZOS


def _open_image(data: bytes) -> Image.Image:
    if not data:
        raise ImageProcessingError("Image payload is empty")
    try:
        with Image.open(BytesIO(data)) as image:
            image = ImageOps.exif_transpose(image)
            return image.convert("RGB")
    except UnidentifiedImageError as exc:
        raise ImageProcessingError("Unsupported image format") from exc
    except Exception as exc:
        raise ImageProcessingError("Failed to read image data") from exc


def _resize_image(image: Image.Image, max_size: int) -> Image.Image:
    resized = image.copy()
    resized.thumbnail((max_size, max_size), resample=_resample_filter())
    return resized


def _encode_jpeg(image: Image.Image, quality: int = JPEG_QUALITY) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buffer.getvalue()


def build_variant_filename(image_id: int | str, variant: str) -> str:
    if variant not in VARIANT_SPECS:
        raise ImageProcessingError(f"Unsupported image variant '{variant}'")
    return f"{image_id}_{variant}.jpg"


def generate_image_variants(data: bytes) -> ProcessedImageVariants:
    base_image = _open_image(data)
    original_bytes = _encode_jpeg(base_image)
    medium_bytes = _encode_jpeg(_resize_image(base_image, MEDIUM_MAX_SIZE))
    thumb_bytes = _encode_jpeg(_resize_image(base_image, THUMB_MAX_SIZE))
    return ProcessedImageVariants(
        original=original_bytes,
        medium=medium_bytes,
        thumb=thumb_bytes,
    )


def save_image_variants(
    variants: Mapping[str, bytes],
    output_dir: Path,
    image_id: int | str,
) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    saved_paths: dict[str, Path] = {}
    for variant, payload in variants.items():
        filename = build_variant_filename(image_id, variant)
        path = output_dir / filename
        path.write_bytes(payload)
        saved_paths[variant] = path
    return saved_paths

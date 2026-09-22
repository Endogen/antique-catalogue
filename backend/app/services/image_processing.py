from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Mapping

from app.core.settings import get_settings

# Hard ceiling on decoded pixel count, applied to every entry point that reads
# an uploaded image (direct upload, speed capture, resumable upload, archive
# restore). The default lives here rather than in Pillow's own default so the
# limit cannot drift between Pillow releases and is reviewed alongside the rest
# of the image pipeline.
MAX_IMAGE_PIXELS = 80_000_000

try:
    from PIL import Image, ImageOps, UnidentifiedImageError
except ModuleNotFoundError:  # pragma: no cover - handled via runtime check
    Image = None  # type: ignore[assignment]
    ImageOps = None  # type: ignore[assignment]
    UnidentifiedImageError = Exception  # type: ignore[misc,assignment]

    PIL_AVAILABLE = False
else:
    PIL_AVAILABLE = True
    # Pillow warns above this threshold and errors above twice the threshold.
    # Keep its guard as defense in depth; _open_image enforces our exact cap
    # before EXIF processing or decoding can allocate the full pixel buffer.
    Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

# "original" keeps whatever resolution was uploaded unless a cap is configured;
# "large" backs the lightbox, which would otherwise download the full-size file.
VARIANT_NAMES: tuple[str, ...] = ("original", "large", "medium", "thumb")


def variant_max_sizes() -> dict[str, int | None]:
    """Longest-edge limit per variant, or None to keep the uploaded size."""
    settings = get_settings()
    return {
        "original": settings.image_original_max_size,
        "large": settings.image_large_max_size,
        "medium": settings.image_medium_max_size,
        "thumb": settings.image_thumb_max_size,
    }


class ImageProcessingError(ValueError):
    pass


@dataclass(frozen=True)
class ProcessedImageVariants:
    variants: Mapping[str, bytes]

    def as_dict(self) -> dict[str, bytes]:
        return dict(self.variants)


def _resample_filter():
    if not PIL_AVAILABLE:  # pragma: no cover - guarded by callers
        raise ImageProcessingError("Image processing requires Pillow")
    return getattr(Image, "Resampling", Image).LANCZOS


def _open_image(data: bytes) -> Image.Image:
    if not PIL_AVAILABLE:
        raise ImageProcessingError("Image processing requires Pillow")
    if not data:
        raise ImageProcessingError("Image payload is empty")
    try:
        with Image.open(BytesIO(data)) as image:
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise ImageProcessingError("Image dimensions are too large")
            image = ImageOps.exif_transpose(image)
            return image.convert("RGB")
    except ImageProcessingError:
        raise
    except UnidentifiedImageError as exc:
        raise ImageProcessingError("Unsupported image format") from exc
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ImageProcessingError("Image dimensions are too large") from exc
    except Exception as exc:
        raise ImageProcessingError("Failed to read image data") from exc


def validate_image(data: bytes) -> None:
    """Decode with the same dimension/corruption checks, without encoding variants."""
    with _open_image(data):
        pass


def _resize_image(image: Image.Image, max_size: int) -> Image.Image:
    resized = image.copy()
    resized.thumbnail((max_size, max_size), resample=_resample_filter())
    return resized


def _encode_jpeg(image: Image.Image, quality: int | None = None) -> bytes:
    if quality is None:
        quality = get_settings().image_jpeg_quality
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True, progressive=True)
    return buffer.getvalue()


def build_variant_filename(image_id: int | str, variant: str) -> str:
    if variant not in VARIANT_NAMES:
        raise ImageProcessingError(f"Unsupported image variant '{variant}'")
    return f"{image_id}_{variant}.jpg"


def generate_image_variants(data: bytes) -> ProcessedImageVariants:
    base_image = _open_image(data)
    sizes = variant_max_sizes()
    variants: dict[str, bytes] = {}
    for variant in VARIANT_NAMES:
        max_size = sizes[variant]
        # Never upscale: a variant larger than the source is just wasted bytes.
        if max_size is None or max(base_image.size) <= max_size:
            variants[variant] = _encode_jpeg(base_image)
        else:
            variants[variant] = _encode_jpeg(_resize_image(base_image, max_size))
    return ProcessedImageVariants(variants)


def generate_image_variant(data: bytes, variant: str) -> bytes:
    build_variant_filename(0, variant)  # Validate before decoding.
    image = _open_image(data)
    max_size = variant_max_sizes()[variant]
    if max_size is not None and max(image.size) > max_size:
        image = _resize_image(image, max_size)
    return _encode_jpeg(image)


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
        # Readers must never see a partly written variant, including when two
        # requests generate a missing legacy preview at the same time.
        with NamedTemporaryFile(dir=output_dir, delete=False) as temporary:
            temporary_path = Path(temporary.name)
            try:
                temporary.write(payload)
                temporary.close()
                temporary_path.replace(path)
            finally:
                temporary_path.unlink(missing_ok=True)
        saved_paths[variant] = path
    return saved_paths

"use client";

/**
 * Downscales a captured photo before it is queued for upload.
 *
 * Phone cameras produce several megabytes per shot, and on a mobile uplink that
 * transfer is the slowest part of capturing. Re-encoding to a sane long edge
 * typically cuts it by an order of magnitude, keeps large photos under the
 * server's byte limit instead of failing outright, and leaves fewer megabytes
 * parked in IndexedDB while the queue drains.
 *
 * Nothing is lost that the server kept anyway: it re-encodes every upload to
 * JPEG without an `exif=` argument, so capture metadata is already discarded
 * there. Orientation is the exception — it must be baked in here, because the
 * pixels we send no longer carry the EXIF tag the server would have applied.
 */

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Longest edge, in pixels, that a queued photo is reduced to. */
export const CAPTURE_MAX_SIZE = parseNumber(
  process.env.NEXT_PUBLIC_IMAGE_MAX_SIZE,
  2560
);

/** JPEG quality for the re-encode, 0-1. */
export const CAPTURE_QUALITY = Math.min(
  1,
  parseNumber(process.env.NEXT_PUBLIC_IMAGE_QUALITY, 0.82)
);

/**
 * Refuse to decode anything wildly beyond a camera's output. Decoding is what
 * allocates width x height x 4 bytes, so this guards against an out-of-memory
 * crash on a low-end phone rather than against slow uploads.
 */
const MAX_DECODE_BYTES = 64 * 1024 * 1024;

type Drawable = ImageBitmap | HTMLImageElement;

const dimensionsOf = (source: Drawable) =>
  source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };

/**
 * Decoding must not be able to hang the capture flow. An element that fires
 * neither load nor error would otherwise leave the upload waiting forever, so
 * give up after a bounded wait and let the caller send the file untouched.
 */
const loadImageElement = (file: Blob, timeoutMs: number) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const settle = (finish: () => void) => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      finish();
    };
    const timer = window.setTimeout(
      () => settle(() => reject(new Error("Timed out decoding the image."))),
      timeoutMs
    );
    image.onload = () => settle(() => resolve(image));
    image.onerror = () =>
      settle(() => reject(new Error("Could not decode the selected image.")));
    image.src = url;
  });

const decode = async (file: Blob, timeoutMs: number): Promise<Drawable> => {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" applies the EXIF rotation; without it the bitmap keeps the
      // sensor orientation and the re-encoded photo comes out sideways.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Older Safari rejects the options bag. An <img> element applies the
      // orientation on its own, so fall back to that rather than to a bare
      // createImageBitmap call.
    }
  }
  return loadImageElement(file, timeoutMs);
};

const encode = async (
  canvas: OffscreenCanvas | HTMLCanvasElement,
  quality: number
): Promise<Blob | null> => {
  if (canvas instanceof HTMLCanvasElement) {
    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality)
    );
  }
  return canvas.convertToBlob({ type: "image/jpeg", quality });
};

const jpegName = (name: string) => {
  const base = name.replace(/\.[^./\\]+$/, "") || "photo";
  return `${base}.jpg`;
};

/**
 * Returns a smaller JPEG, or the original file when shrinking it would not
 * help. Never throws for image input: a browser that cannot decode or encode
 * the photo falls back to uploading it untouched.
 */
export async function prepareImageForUpload(
  file: File,
  options: { maxSize?: number; quality?: number; decodeTimeoutMs?: number } = {}
): Promise<File> {
  const maxSize = options.maxSize ?? CAPTURE_MAX_SIZE;
  const quality = options.quality ?? CAPTURE_QUALITY;
  const decodeTimeoutMs = options.decodeTimeoutMs ?? 15_000;

  if (!file.type.startsWith("image/") || file.size > MAX_DECODE_BYTES) {
    return file;
  }

  let source: Drawable | null = null;
  try {
    source = await decode(file, decodeTimeoutMs);
    const { width, height } = dimensionsOf(source);
    if (!width || !height) {
      return file;
    }

    const scale = Math.min(1, maxSize / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(targetWidth, targetHeight)
        : Object.assign(document.createElement("canvas"), {
            width: targetWidth,
            height: targetHeight
          });

    const context = canvas.getContext("2d") as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!context) {
      return file;
    }
    context.drawImage(source as CanvasImageSource, 0, 0, targetWidth, targetHeight);

    const blob = await encode(canvas, quality);
    // Re-encoding a small or already-compressed photo can grow it; keep whichever
    // is smaller so this can never make an upload worse.
    if (!blob || blob.size >= file.size) {
      return file;
    }
    return new File([blob], jpegName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified
    });
  } catch {
    return file;
  } finally {
    if (source && "close" in source) {
      source.close();
    }
  }
}

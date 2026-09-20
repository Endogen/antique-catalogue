import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareImageForUpload } from "@/lib/image-resize";

const file = (bytes: number, type = "image/jpeg", name = "IMG_0001.HEIC") =>
  new File([new Uint8Array(bytes)], name, { type });

/** Minimal stand-ins for the decode/encode APIs jsdom does not implement. */
const stubBrowserImaging = (
  source: { width: number; height: number },
  encodedBytes: number
) => {
  const close = vi.fn();
  const drawImage = vi.fn();
  const encode = vi.fn(async () => new Blob([new Uint8Array(encodedBytes)], { type: "image/jpeg" }));
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ ...source, close }))
  );
  class FakeOffscreenCanvas {
    constructor(
      public width: number,
      public height: number
    ) {}
    getContext() {
      return { drawImage };
    }
    convertToBlob = encode;
  }
  vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  return { close, drawImage, encode };
};

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("prepareImageForUpload", () => {
  it("shrinks an oversized photo to the configured long edge and re-encodes as JPEG", async () => {
    const { drawImage, encode } = stubBrowserImaging({ width: 4032, height: 3024 }, 500_000);
    const original = file(6_000_000);

    const prepared = await prepareImageForUpload(original, {
      maxSize: 2560,
      quality: 0.82
    });

    expect(prepared).not.toBe(original);
    expect(prepared.size).toBe(500_000);
    expect(prepared.type).toBe("image/jpeg");
    // The extension has to follow the re-encode, not the camera's original.
    expect(prepared.name).toBe("IMG_0001.jpg");

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1920);
    expect(encode).toHaveBeenCalledWith({ type: "image/jpeg", quality: 0.82 });
    expect(createImageBitmap).toHaveBeenCalledWith(original, { imageOrientation: "from-image" });
  });

  it("brings a photo that the server would reject under the limit", async () => {
    stubBrowserImaging({ width: 8000, height: 6000 }, 700_000);
    const tooLarge = file(14_000_000);

    const prepared = await prepareImageForUpload(tooLarge);

    expect(tooLarge.size).toBeGreaterThan(10 * 1024 * 1024);
    expect(prepared.size).toBeLessThan(10 * 1024 * 1024);
  });

  it("keeps the original when re-encoding would not make it smaller", async () => {
    stubBrowserImaging({ width: 640, height: 480 }, 900_000);
    const small = file(120_000);

    expect(await prepareImageForUpload(small)).toBe(small);
  });

  it("releases the decoded bitmap", async () => {
    const { close } = stubBrowserImaging({ width: 4032, height: 3024 }, 400_000);
    await prepareImageForUpload(file(5_000_000));
    expect(close).toHaveBeenCalled();
  });

  it("falls back to the untouched file when the browser cannot decode it", async () => {
    // jsdom has no createImageBitmap and no canvas encoder; the upload must
    // still go ahead rather than failing because the resize did.
    const original = file(3_000_000);
    expect(
      await prepareImageForUpload(original, { decodeTimeoutMs: 50 })
    ).toBe(original);
  });

  it("leaves non-images and implausibly large files alone", async () => {
    stubBrowserImaging({ width: 4032, height: 3024 }, 100);
    const pdf = file(1000, "application/pdf", "scan.pdf");
    const huge = file(80 * 1024 * 1024);

    expect(await prepareImageForUpload(pdf)).toBe(pdf);
    expect(await prepareImageForUpload(huge)).toBe(huge);
  });
});


it("times out a stalled bitmap decoder and closes a bitmap that arrives late", async () => {
  vi.useFakeTimers();
  let finish!: (bitmap: ImageBitmap) => void;
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn(() => new Promise(resolve => { finish = resolve; })));
  const original = file(1000);
  const settled = vi.fn();
  const prepared = prepareImageForUpload(original, { decodeTimeoutMs: 50 }).then(settled);
  await vi.advanceTimersByTimeAsync(100);
  expect(settled).toHaveBeenCalledWith(original);
  finish({ width: 10, height: 10, close } as unknown as ImageBitmap);
  await prepared;
  await vi.advanceTimersByTimeAsync(0);
  expect(close).toHaveBeenCalledOnce();
});

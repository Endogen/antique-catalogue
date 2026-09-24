import { afterEach, expect, test, vi } from "vitest";
import { createUuid } from "@/lib/uuid";

afterEach(() => vi.unstubAllGlobals());

test("uses the native UUID generator when available", () => {
  const randomUUID = vi.fn(() => "32b43f99-3ba1-4a23-944e-2c164b8c2670");
  vi.stubGlobal("crypto", { randomUUID });
  expect(createUuid()).toBe("32b43f99-3ba1-4a23-944e-2c164b8c2670");
  expect(randomUUID).toHaveBeenCalledOnce();
});

test.each([
  [0, "00000000-0000-4000-8000-000000000000"],
  [255, "ffffffff-ffff-4fff-bfff-ffffffffffff"]
])("generates UUID v4 from random bytes without randomUUID (%i)", (byte, expected) => {
  const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(byte as number));
  vi.stubGlobal("crypto", { getRandomValues });
  expect(createUuid()).toBe(expected);
  expect(getRandomValues).toHaveBeenCalledOnce();
  expect(getRandomValues.mock.calls[0][0]).toHaveLength(16);
});

test("requests fresh randomness for each fallback UUID", () => {
  let seed = 0;
  vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(++seed) });
  expect(createUuid()).not.toBe(createUuid());
});

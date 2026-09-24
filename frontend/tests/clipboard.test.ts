import { afterEach, expect, test, vi } from "vitest";
import { copyText } from "@/lib/clipboard";

const execCommand = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  execCommand.mockReset();
  Reflect.deleteProperty(document, "execCommand");
});

const stubLegacyCopy = (result: boolean) => {
  execCommand.mockImplementation(() => result);
  Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
};

test("uses the Clipboard API when the page is a secure context", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  stubLegacyCopy(true);

  await copyText("https://example.com/item");

  expect(writeText).toHaveBeenCalledWith("https://example.com/item");
  expect(execCommand).not.toHaveBeenCalled();
});

test("falls back to the legacy copy command without the Clipboard API", async () => {
  vi.stubGlobal("navigator", {});
  stubLegacyCopy(true);
  const button = document.createElement("button");
  document.body.appendChild(button);
  button.focus();

  await copyText("http://100.64.0.1:3000/explore/1");

  expect(execCommand).toHaveBeenCalledWith("copy");
  expect(document.querySelector("textarea")).toBeNull();
  expect(document.activeElement).toBe(button);
  button.remove();
});

test("falls back when the Clipboard API rejects", async () => {
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
  stubLegacyCopy(true);

  await copyText("value");

  expect(execCommand).toHaveBeenCalledWith("copy");
});

test("rejects when neither copy mechanism succeeds", async () => {
  vi.stubGlobal("navigator", {});
  stubLegacyCopy(false);

  await expect(copyText("value")).rejects.toThrow("Clipboard is unavailable.");
  expect(document.querySelector("textarea")).toBeNull();
});

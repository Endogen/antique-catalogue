import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemForm, buildMetadataDefaults, validateMetadata } from "@/components/item-form";
import { VerificationResend } from "@/components/verification-resend";
import { apiFetch, authApi, setAccessToken } from "@/lib/api";
import { clearAuthenticatedImageCache, useAuthenticatedImageUrl } from "@/lib/use-authenticated-image";
import { serializeTimestamp, timestampInput } from "@/lib/metadata-form";
import type { FieldDefinitionResponse } from "@/lib/api";

vi.mock("@/components/i18n-provider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const fields: FieldDefinitionResponse[] = [{ id: 1, collection_id: 1, name: "Manufacturer", field_type: "text", is_required: false, is_private: false, options: null, position: 1, created_at: "", updated_at: "" }];
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const expired = `x.${btoa(JSON.stringify({ exp: 1 }))}.x`;

beforeEach(() => {
  window.localStorage.clear();
  setAccessToken(null);
  clearAuthenticatedImageCache();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("catalogue forms", () => {
  it("keeps migrated field values when only the item name changes", async () => {
    const save = vi.fn();
    render(<ItemForm fields={fields} initialValues={{ name: "Vase", metadata: { Manufacturer: "Meissen" } }} onSubmit={save} submitLabel="Save" />);
    await userEvent.clear(screen.getByLabelText("Item name"));
    await userEvent.type(screen.getByLabelText("Item name"), "Updated vase");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated vase", metadata: { Manufacturer: "Meissen" } })));
  });

  it("round-trips an unchanged timestamp including offset and seconds", async () => {
    const save = vi.fn();
    const original = "2026-09-13T10:30:45.123+02:00";
    render(<ItemForm fields={[{ ...fields[0], name: "Acquired", field_type: "timestamp" }]} initialValues={{ name: "Vase", metadata: { Acquired: original } }} onSubmit={save} submitLabel="Save" />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ metadata: { Acquired: original } })));
  });

  it("converts an edited local timestamp to an unambiguous instant", () => {
    const input = "2026-09-14T12:00:01";
    expect(serializeTimestamp(input, "2026-09-13T10:30:45+02:00")).toBe(new Date(input).toISOString());
    expect(serializeTimestamp(timestampInput("2026-09-13T10:30:45Z"), "2026-09-13T10:30:45Z")).toBe("2026-09-13T10:30:45Z");
  });

  it("allows moving a draft whose hidden source required fields are incomplete", async () => {
    const save = vi.fn();
    render(<ItemForm fields={[{ ...fields[0], is_required: true }]} skipMetadataValidation initialValues={{ name: "Draft 1" }} onSubmit={save} submitLabel="Move" />);
    await userEvent.click(screen.getByRole("button", { name: "Move" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
  });

  it("resends verification and shows the delivery result", async () => {
    const resend = vi.spyOn(authApi, "resendVerification").mockResolvedValue({ message: "Verification sent" });
    render(<VerificationResend />);
    await userEvent.type(screen.getByLabelText("Email"), "collector@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Verification sent"));
    expect(resend).toHaveBeenCalledWith("collector@example.com");
  });
});

describe("authenticated images", () => {
  it("refreshes an expired session and then loads the image", async () => {
    setAccessToken(expired);
    vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:photo"); static revokeObjectURL = vi.fn(); });
    const fetcher = vi.mocked(fetch).mockImplementation(async url => String(url).endsWith("/auth/refresh") ? json({ access_token: "fresh-token" }) : new Response(new Blob(["photo"], { type: "image/jpeg" })));
    const { result, unmount } = renderHook(() => useAuthenticatedImageUrl("/api/images/1/thumb.jpg"));
    await waitFor(() => expect(result.current).toBe("blob:photo"));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe("/api/auth/refresh");
    expect(fetcher.mock.calls[1][0]).toBe("/api/images/1/thumb.jpg");
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get("Authorization")).toBe("Bearer fresh-token");
    // Reopening the image must check server access again.
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
  });

  it("shares concurrent image requests but revalidates after the last consumer leaves", async () => {
    setAccessToken("token");
    vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:photo"); static revokeObjectURL = vi.fn(); });
    const fetcher = vi.mocked(fetch).mockImplementation(async () => new Response(new Blob(["photo"], { type: "image/jpeg" })));
    const url = "/api/images/7/medium.jpg";

    const first = renderHook(() => useAuthenticatedImageUrl(url));
    const second = renderHook(() => useAuthenticatedImageUrl(url));
    await waitFor(() => expect(first.result.current).toBe("blob:photo"));
    await waitFor(() => expect(second.result.current).toBe("blob:photo"));
    expect(fetcher).toHaveBeenCalledTimes(1);

    first.unmount();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    second.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
    const remounted = renderHook(() => useAuthenticatedImageUrl(url));
    await waitFor(() => expect(remounted.result.current).toBe("blob:photo"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent refreshes for image and JSON requests", async () => {
    setAccessToken("old-token");
    let renew!: (value: Response) => void;
    const pending = new Promise<Response>(resolve => { renew = resolve; });
    const fetcher = vi.mocked(fetch).mockImplementation(async (url, options) => {
      if (String(url).endsWith("/auth/refresh")) return pending;
      return new Headers(options?.headers).get("Authorization") === "Bearer fresh-token" ? json({ ok: true }) : json({}, 401);
    });
    const requests = [apiFetch("/images/1/thumb.jpg"), apiFetch("/collections")];
    await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"))).toHaveLength(1));
    renew(json({ access_token: "fresh-token" }));
    expect((await Promise.all(requests)).map(r => r.status)).toEqual([200, 200]);
  });

  it("uses the in-memory token when localStorage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    setAccessToken("memory-token");
    const fetcher = vi.mocked(fetch).mockResolvedValue(json({ ok: true }));
    await apiFetch("/images/1/thumb.jpg");
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer memory-token");
  });
});


describe("numeric metadata", () => {
  const numeric = [{ ...fields[0], field_type: "number" as const }];
  it.each([Infinity, -Infinity, NaN, "1e309"])("rejects %s before JSON serialization", value => {
    const result = validateMetadata(numeric, { "1": value }, key => key);
    expect(result.errors).toEqual([{ fieldId: "1", message: "Value must be a number" }]);
    expect(result.payload?.Manufacturer).toBeUndefined();
    expect(buildMetadataDefaults(numeric, { Manufacturer: value })["1"]).toBe("");
  });
  it("keeps finite numeric values", () => {
    expect(validateMetadata(numeric, { "1": "9.5" }, key => key)).toEqual({ payload: { Manufacturer: 9.5 }, errors: [] });
  });
});

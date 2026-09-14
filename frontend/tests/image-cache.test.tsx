import { it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { clearAuthenticatedImageCache, useAuthenticatedImageUrl } from "@/lib/use-authenticated-image";
import { apiFetch } from "@/lib/api";
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
beforeEach(() => { vi.mocked(apiFetch).mockReset(); });
afterEach(() => { clearAuthenticatedImageCache(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("revalidates a previously public image when it is reopened", async () => {
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:photo"); static revokeObjectURL = vi.fn(); });
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(new Blob(["photo"])))
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
  const first = renderHook(() => useAuthenticatedImageUrl("/api/images/999/thumb.jpg"));
  await waitFor(() => expect(first.result.current).toBe("blob:photo"));
  first.unmount();
  const reopened = renderHook(() => useAuthenticatedImageUrl("/api/images/999/thumb.jpg"));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
  expect(reopened.result.current).toBeNull();
});

it.each(["network", "http"])("an old %s failure cannot delete a new identity's cache entry", async (failure) => {
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:new"); static revokeObjectURL = vi.fn(); });
  let failOld!: () => void;
  let finishNew!: (value: Response) => void;
  vi.mocked(apiFetch).mockImplementationOnce(() => new Promise((resolve, reject) => {
    failOld = () => failure === "network" ? reject(new Error("Old request failed")) : resolve(new Response(null, { status: 404 }));
  }))
    .mockImplementationOnce(() => new Promise(resolve => { finishNew = resolve; }));
  const old = renderHook(() => useAuthenticatedImageUrl("/api/images/777/thumb.jpg"));
  clearAuthenticatedImageCache();
  old.unmount();
  const current = renderHook(() => useAuthenticatedImageUrl("/api/images/777/thumb.jpg"));
  await act(async () => { failOld(); });
  await act(async () => { finishNew(new Response(new Blob(["new"]))); });
  await waitFor(() => expect(current.result.current).toBe("blob:new"));
});

it("an old consumer's cleanup cannot release a new entry for the same URL", async () => {
  let serial = 0;
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => `blob:${++serial}`);
    static revokeObjectURL = vi.fn();
  });
  vi.mocked(apiFetch).mockImplementation(async () => new Response(new Blob(["photo"])));
  const url = "/api/images/7/thumb.jpg";
  const old = renderHook(() => useAuthenticatedImageUrl(url));
  await waitFor(() => expect(old.result.current).toBe("blob:1"));
  clearAuthenticatedImageCache();
  const current = renderHook(() => useAuthenticatedImageUrl(url));
  await waitFor(() => expect(current.result.current).toBe("blob:2"));
  old.unmount();
  expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:2");
  const concurrent = renderHook(() => useAuthenticatedImageUrl(url));
  await waitFor(() => expect(concurrent.result.current).toBe("blob:2"));
  expect(apiFetch).toHaveBeenCalledTimes(2);
});

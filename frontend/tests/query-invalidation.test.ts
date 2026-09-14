import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";

import { apiRequest, collectionApi, setAccessToken } from "@/lib/api";
import { connectQueryInvalidation } from "@/lib/query-invalidation";
import { queryKeys } from "@/lib/query-keys";

let client: QueryClient;
let disconnect: () => void;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json" }
});

beforeEach(() => {
  setAccessToken("test-token");
  client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } });
  disconnect = connectQueryInvalidation(client);
  vi.stubGlobal("fetch", vi.fn(async () => json({})));
});
afterEach(() => { disconnect(); client.clear(); setAccessToken(null); vi.unstubAllGlobals(); });

it("refreshes an active list after creation and invalidates inactive derived views", async () => {
  let saved: unknown[] = [];
  vi.mocked(fetch).mockImplementation(async (_url, init) => {
    if (init?.method === "POST") {
      saved = [{ id: 1, name: "Ceramics" }];
      return json(saved[0]);
    }
    return json(saved);
  });
  const observer = new QueryObserver(client, { queryKey: queryKeys.collections.list(), queryFn: () => collectionApi.list() });
  const unsubscribe = observer.subscribe(() => {});
  await waitFor(() => expect(observer.getCurrentResult().data).toEqual([]));
  client.setQueryData(queryKeys.profile.publicCollections("collector"), []);
  client.setQueryData(queryKeys.activity.list(5), []);
  await collectionApi.create({ name: "Ceramics" });
  await waitFor(() => expect(observer.getCurrentResult().data).toEqual(saved));
  expect(client.getQueryState(queryKeys.profile.publicCollections("collector"))?.isInvalidated).toBe(true);
  expect(client.getQueryState(queryKeys.activity.list(5))?.isInvalidated).toBe(true);
  unsubscribe();
});

it.each([
  ["/collections/1/items/2", "PATCH", {}, queryKeys.collections.items(1)],
  ["/collections/1/items/2", "DELETE", {}, queryKeys.search.items("vase")],
  ["/collections/1/fields", "POST", {}, queryKeys.collections.fields(1)],
  ["/collections/1/apply-template", "POST", {}, queryKeys.collections.fields(1)],
  ["/schema-templates/1/fields", "POST", {}, queryKeys.schemaTemplates.fields("template:1")],
  ["/archives/restore", "POST", {}, queryKeys.collections.list()],
  ["/uploads/receipt/complete", "POST", { result: { item_id: 2 } }, queryKeys.items.images(2)],
  ["/uploads", "POST", { result: { item_id: 2 } }, queryKeys.collections.items(1)],
  ["/stars/collections/1/items/2", "DELETE", {}, queryKeys.stars.items()],
  ["/profiles/me", "PATCH", {}, queryKeys.profile.public("old-name")],
  ["/admin/featured", "POST", {}, queryKeys.explore.featured()]
])("invalidates dependent cached data after %s %s", async (path, method, data, key) => {
  client.setQueryData(key, []);
  vi.mocked(fetch).mockResolvedValueOnce(json(data));
  await apiRequest(path, { method });
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
});

it.each([
  ["/collections", "GET", {}],
  ["/archives/preview", "POST", {}],
  ["/uploads/job?offset=0", "PUT", { result: null }],
  ["/auth/refresh", "POST", {}]
])("does not invalidate catalogue data for %s %s", async (path, method, data) => {
  client.setQueryData(queryKeys.collections.list(), []);
  vi.mocked(fetch).mockResolvedValueOnce(json(data));
  await apiRequest(path, { method });
  expect(client.getQueryState(queryKeys.collections.list())?.isInvalidated).toBe(false);
});

it("keeps cached data fresh when a write fails", async () => {
  client.setQueryData(queryKeys.collections.list(), []);
  vi.mocked(fetch).mockResolvedValueOnce(json({ detail: "Invalid name" }, 422));
  await expect(collectionApi.create({ name: "" })).rejects.toMatchObject({ status: 422 });
  expect(client.getQueryState(queryKeys.collections.list())?.isInvalidated).toBe(false);
});

it("does not let a read started before a write overwrite the updated list", async () => {
  let finishOld!: (response: Response) => void;
  let firstRead = true;
  vi.mocked(fetch).mockImplementation(async (_url, init) => {
    if (init?.method === "POST") return json({ id: 1, name: "Ceramics" });
    if (firstRead) {
      firstRead = false;
      return new Promise<Response>((resolve) => { finishOld = resolve; });
    }
    return json([{ id: 1, name: "Ceramics" }]);
  });
  const observer = new QueryObserver(client, {
    queryKey: queryKeys.collections.list(),
    queryFn: ({ signal }) => collectionApi.list({ signal })
  });
  const unsubscribe = observer.subscribe(() => {});
  await collectionApi.create({ name: "Ceramics" });
  finishOld(json([]));
  await waitFor(() => expect(observer.getCurrentResult().data).toEqual([{ id: 1, name: "Ceramics" }]));
  unsubscribe();
});

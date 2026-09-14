import type { QueryClient, QueryFilters } from "@tanstack/react-query";

import { subscribeToApiMutations, type ApiMutation } from "@/lib/api-mutations";

// A catalogue write can change counts, previews, rankings, search results and
// public visibility as well as the resource itself. Invalidate those views
// together, including inactive queries that will be revisited after navigation.
const catalogueRoots = ["collections", "items", "explore", "search", "stars", "profile", "activity", "admin"];

function affectedRoots({ path, data }: ApiMutation): string[] {
  if (path.startsWith("/schema-templates")) return ["schema-templates", "activity"];
  if (/^\/(collections|items|stars|profiles|speed-capture)(\/|$)/.test(path)) return catalogueRoots;
  if (path === "/archives/restore") return catalogueRoots;
  if (path.startsWith("/admin/") && path !== "/admin/login") return catalogueRoots;
  // Creating/resuming a transfer may return an already completed receipt.
  // Invalidate for that result too, but never for each in-progress chunk.
  if (path.startsWith("/uploads") && data && typeof data === "object" && "result" in data && data.result) {
    return catalogueRoots;
  }
  return [];
}

export function connectQueryInvalidation(client: QueryClient) {
  return subscribeToApiMutations((mutation) => {
    const roots = affectedRoots(mutation);
    if (roots.length) {
      const filters: QueryFilters = { predicate: (query) => roots.includes(String(query.queryKey[0])) };
      // Cancel even an initial read with no cached data. Otherwise invalidation
      // can reuse that pre-write request and store its obsolete response.
      void client.cancelQueries(filters);
      void client.invalidateQueries(filters);
    }
  });
}

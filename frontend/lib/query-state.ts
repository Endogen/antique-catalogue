import type { UseQueryResult } from "@tanstack/react-query";

import { isApiError } from "@/lib/api";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export type LoadState<T> = {
  status: LoadStatus;
  data: T;
  error?: string;
};

/**
 * Adapts a react-query result to the `{ status, data, error }` shape the pages
 * render from.
 *
 * react-query owns the parts that were previously hand-rolled and subtly wrong:
 * in-flight requests are cancelled on key change, only the newest response is
 * kept (no stale overwrite), identical keys are deduped, and results are cached
 * across navigation.
 */
export function toLoadState<T>(
  query: Pick<
    UseQueryResult<T>,
    "data" | "error" | "isError" | "isPending" | "fetchStatus"
  >,
  fallbackError: string,
  fallbackData: T
): LoadState<T> {
  if (query.isError) {
    return {
      status: "error",
      data: query.data ?? fallbackData,
      error: isApiError(query.error) ? query.error.detail : fallbackError
    };
  }

  if (query.isPending) {
    // A pending query that is not fetching is disabled, not loading.
    return {
      status: query.fetchStatus === "idle" ? "idle" : "loading",
      data: fallbackData
    };
  }

  return { status: "ready", data: query.data ?? fallbackData };
}

"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { isApiError } from "@/lib/api";
import { connectQueryInvalidation } from "@/lib/query-invalidation";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Results stay fresh briefly so back-navigation is instant, while a
        // manual refresh or mutation invalidation still refetches immediately.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Retrying an auth or missing-resource failure only delays the error.
          if (isApiError(error) && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        }
      }
    }
  });

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One client per browser session; never shared across requests on the server.
  const [client] = React.useState(createQueryClient);

  React.useEffect(() => connectQueryInvalidation(client), [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

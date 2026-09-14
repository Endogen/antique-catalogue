"use client";

import { ErrorState } from "@/components/error-state";

export default function AppRouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} />;
}

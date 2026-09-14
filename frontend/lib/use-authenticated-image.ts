import * as React from "react";

import { apiFetch } from "@/lib/api";

/**
 * Fetches an image URL with the current Bearer token
 * and returns a blob: URL for use in <img> tags.
 */
export function useAuthenticatedImageUrl(url: string | null): string | null {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!url) {
      setBlobUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return null;
      });
      return;
    }

    setBlobUrl(null);
    let objectUrl: string | null = null;
    const controller = new AbortController();

    const fetchImage = async () => {
      try {
        const response = await apiFetch(url, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) {
          setBlobUrl(null);
          return;
        }

        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl((previous) => {
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return objectUrl;
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setBlobUrl(null);
        // Silently fail — image just won't show
      }
    };

    void fetchImage();

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  return blobUrl;
}

import * as React from "react";

const ACCESS_TOKEN_STORAGE_KEY = "antique_access_token";

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

    let objectUrl: string | null = null;
    const controller = new AbortController();

    const fetchImage = async () => {
      try {
        const token =
          typeof window !== "undefined"
            ? window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
            : null;

        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          headers,
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) {
          setBlobUrl(null);
          return;
        }

        const blob = await response.blob();
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

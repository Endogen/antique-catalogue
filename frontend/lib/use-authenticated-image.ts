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
      setBlobUrl(null);
      return;
    }

    let revoked = false;
    let objectUrl: string | null = null;

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

        const response = await fetch(url, { headers });
        if (!response.ok) return;

        const blob = await response.blob();
        if (revoked) return;

        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch {
        // Silently fail — image just won't show
      }
    };

    void fetchImage();

    return () => {
      revoked = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  return blobUrl;
}

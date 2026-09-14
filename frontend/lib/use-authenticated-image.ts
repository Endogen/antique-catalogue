import * as React from "react";

import { apiFetch } from "@/lib/api";

/**
 * Share authenticated image requests and blobs between mounted consumers.
 *
 * Images are fetched with a Bearer token, so they cannot go through the normal
 * browser image cache. Concurrent uses of one image share a request.
 *
 * Drop a blob when its last consumer leaves. Reopening it must ask the server
 * again: ownership and public visibility may have changed in another session.
 */
type CacheEntry = {
  promise: Promise<string | null>;
  objectUrl: string | null;
  refs: number;
};

const cache = new Map<string, CacheEntry>();

const loadBlobUrl = async (url: string, entry: CacheEntry) => {
  try {
    const response = await apiFetch(url, { cache: "no-store" });
    if (!response.ok) {
      if (cache.get(url) === entry) cache.delete(url);
      return null;
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    // The entry may have been evicted or cleared while the request was in flight.
    if (cache.get(url) !== entry) {
      URL.revokeObjectURL(objectUrl);
      return null;
    }
    entry.objectUrl = objectUrl;
    return objectUrl;
  } catch {
    // Leave no failed entry behind, so a later mount can retry.
    if (cache.get(url) === entry) cache.delete(url);
    return null;
  }
};

const acquire = (url: string): CacheEntry => {
  const existing = cache.get(url);
  if (existing) {
    existing.refs += 1;
    return existing;
  }

  const entry: CacheEntry = {
    objectUrl: null,
    refs: 1,
    promise: Promise.resolve(null)
  };
  entry.promise = loadBlobUrl(url, entry);
  cache.set(url, entry);
  return entry;
};

const release = (url: string, entry: CacheEntry) => {
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs === 0) {
    if (cache.get(url) === entry) cache.delete(url);
    if (entry.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
      entry.objectUrl = null;
    }
  }
};

/**
 * Drops every cached image. Call when the active identity changes, so one
 * user never sees blobs fetched with another user's token.
 */
export const clearAuthenticatedImageCache = () => {
  for (const entry of cache.values()) {
    if (entry.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
      entry.objectUrl = null;
    }
  }
  cache.clear();
};

/**
 * Fetches an image URL with the current Bearer token and returns a blob: URL.
 */
export function useAuthenticatedImageUrl(url: string | null): string | null {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      return;
    }

    const entry = acquire(url);
    let active = true;

    if (entry.objectUrl) {
      setBlobUrl(entry.objectUrl);
    } else {
      setBlobUrl(null);
      void entry.promise.then((resolved) => {
        if (active) {
          setBlobUrl(resolved);
        }
      });
    }

    return () => {
      active = false;
      release(url, entry);
    };
  }, [url]);

  return blobUrl;
}

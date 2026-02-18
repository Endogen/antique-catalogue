import { headers } from "next/headers";

import { HomePageClient } from "@/components/home-page-client";
import type { CollectionResponse, FeaturedItemResponse } from "@/lib/api";

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const parseForwardedValue = (value: string | null) => value?.split(",")[0]?.trim() ?? "";
const DEFAULT_INTERNAL_API_URL = "http://backend:8000";

const resolveApiUrls = (path: string): string[] => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const configured =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "/api";
  const internalConfigured =
    process.env.INTERNAL_API_URL ??
    process.env.API_INTERNAL_URL ??
    "";

  const urls: string[] = [];

  if (
    internalConfigured.startsWith("http://") ||
    internalConfigured.startsWith("https://")
  ) {
    urls.push(`${stripTrailingSlash(internalConfigured)}${normalized}`);
  }

  if (configured.startsWith("http://") || configured.startsWith("https://")) {
    urls.push(`${stripTrailingSlash(configured)}${normalized}`);
    return [...new Set(urls)];
  }

  const requestHeaders = headers();
  const protocol = parseForwardedValue(requestHeaders.get("x-forwarded-proto")) || "http";
  const host =
    parseForwardedValue(requestHeaders.get("x-forwarded-host")) ||
    parseForwardedValue(requestHeaders.get("host"));
  const basePath = stripTrailingSlash(
    configured.startsWith("/") ? configured : `/${configured}`
  );

  if (host) {
    urls.push(`${protocol}://${host}${basePath}${normalized}`);
  }

  if (!internalConfigured) {
    urls.push(`${DEFAULT_INTERNAL_API_URL}${normalized}`);
  }

  return [...new Set(urls)];
};

async function fetchJson<T>(path: string): Promise<T> {
  const candidates = resolveApiUrls(path);
  let lastError: Error | null = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        lastError = new Error(`Request failed (${response.status}) for ${url}`);
        continue;
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Request failed");
    }
  }

  throw lastError ?? new Error("Request failed");
}

export default async function Home() {
  let featuredCollection: CollectionResponse | null = null;
  let featuredCollectionError = false;
  let featuredItems: FeaturedItemResponse[] = [];

  const [collectionResult, itemsResult] = await Promise.allSettled([
    fetchJson<CollectionResponse | null>("/public/collections/featured"),
    fetchJson<FeaturedItemResponse[]>("/public/collections/featured/items")
  ]);

  if (collectionResult.status === "fulfilled") {
    featuredCollection = collectionResult.value;
  } else {
    featuredCollectionError = true;
  }

  if (itemsResult.status === "fulfilled") {
    featuredItems = itemsResult.value;
  }

  return (
    <HomePageClient
      featuredCollection={featuredCollection}
      featuredCollectionError={featuredCollectionError}
      featuredItems={featuredItems}
    />
  );
}

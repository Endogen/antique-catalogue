import { headers } from "next/headers";

import { HomePageClient } from "@/components/home-page-client";
import type { CollectionResponse, FeaturedItemResponse } from "@/lib/api";

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const resolveApiUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const configured =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "/api";

  if (configured.startsWith("http://") || configured.startsWith("https://")) {
    return `${stripTrailingSlash(configured)}${normalized}`;
  }

  const requestHeaders = headers();
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const basePath = stripTrailingSlash(
    configured.startsWith("/") ? configured : `/${configured}`
  );

  if (!host) {
    return `${basePath}${normalized}`;
  }

  return `${protocol}://${host}${basePath}${normalized}`;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(resolveApiUrl(path), {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
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

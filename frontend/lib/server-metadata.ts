import { headers } from "next/headers";

const DEFAULT_INTERNAL_API_URL = "http://backend:8000";

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const parseForwardedValue = (value: string | null) => value?.split(",")[0]?.trim() ?? "";

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

const getConfiguredApiBase = () =>
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "/api";

const resolveApiFetchCandidates = (path: string): string[] => {
  const normalized = normalizePath(path);
  const configured = getConfiguredApiBase();
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
  const protocol =
    parseForwardedValue(requestHeaders.get("x-forwarded-proto")) || "http";
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

export const getSiteOrigin = (): string | null => {
  const requestHeaders = headers();
  const protocol =
    parseForwardedValue(requestHeaders.get("x-forwarded-proto")) || "http";
  const host =
    parseForwardedValue(requestHeaders.get("x-forwarded-host")) ||
    parseForwardedValue(requestHeaders.get("host"));
  if (!host) {
    return null;
  }
  return `${protocol}://${host}`;
};

export const buildSiteUrl = (path: string): string | null => {
  const origin = getSiteOrigin();
  if (!origin) {
    return null;
  }
  return `${origin}${normalizePath(path)}`;
};

export const buildApiAssetUrl = (path: string): string | null => {
  const normalized = normalizePath(path);
  const configured = getConfiguredApiBase();

  if (configured.startsWith("http://") || configured.startsWith("https://")) {
    return `${stripTrailingSlash(configured)}${normalized}`;
  }

  const origin = getSiteOrigin();
  if (!origin) {
    return null;
  }
  const basePath = stripTrailingSlash(
    configured.startsWith("/") ? configured : `/${configured}`
  );
  return `${origin}${basePath}${normalized}`;
};

export async function fetchApiJson<T>(path: string): Promise<T | null> {
  const candidates = resolveApiFetchCandidates(path);
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }
      return (await response.json()) as T;
    } catch {
      // Try next URL candidate.
    }
  }
  return null;
}

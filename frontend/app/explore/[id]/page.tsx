"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Globe2,
  LogOut,
  RefreshCcw,
  Search,
  Star
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Lightbox } from "@/components/lightbox";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import {
  isApiError,
  imageApi,
  publicCollectionApi,
  publicItemApi,
  starsApi,
  type CollectionResponse,
  type ItemResponse
} from "@/lib/api";
import { cn } from "@/lib/utils";

type LoadState = {
  status: "loading" | "ready" | "error";
  data?: CollectionResponse;
  error?: string;
};

type ItemsState = {
  status: "loading" | "ready" | "error";
  data: ItemResponse[];
  error?: string;
  hasMore: boolean;
};

const PAGE_SIZE = 12;

const buildSortOptions = (t: (key: string) => string) => [
  { label: t("Newest first"), value: "-created_at" },
  { label: t("Oldest first"), value: "created_at" },
  { label: t("Name A to Z"), value: "name" },
  { label: t("Name Z to A"), value: "-name" }
];

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
};

const highlightCardClass =
  "border-amber-400 bg-amber-50/45 ring-2 ring-amber-300/70 shadow-[0_0_0_1px_rgba(251,191,36,0.85),0_18px_36px_-20px_rgba(217,119,6,0.75)]";

export default function PublicCollectionPage() {
  const { isAuthenticated, logout, status: authStatus } = useAuth();
  const params = useParams();
  const { t, locale } = useI18n();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const sortOptions = React.useMemo(() => buildSortOptions(t), [t]);

  const formatDate = React.useCallback(
    (value?: string | null) => {
      if (!value) {
        return "-";
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }
      return new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric"
      }).format(parsed);
    },
    [locale]
  );

  const formatMetadataValue = React.useCallback(
    (value: unknown) => {
      if (value === null || value === undefined) {
        return "-";
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "number") {
        return new Intl.NumberFormat(locale).format(value);
      }
      if (typeof value === "boolean") {
        return value ? t("Yes") : t("No");
      }
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      if (typeof value === "object") {
        return t("Details");
      }
      return String(value);
    },
    [locale, t]
  );

  const [collectionState, setCollectionState] = React.useState<LoadState>({
    status: "loading"
  });
  const [itemsState, setItemsState] = React.useState<ItemsState>({
    status: "loading",
    data: [],
    hasMore: false
  });
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState(sortOptions[0]?.value ?? "-created_at");
  const [filterImages, setFilterImages] = React.useState(false);
  const [filterHighlight, setFilterHighlight] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = React.useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [collectionStarred, setCollectionStarred] = React.useState(false);
  const [isUpdatingCollectionStar, setIsUpdatingCollectionStar] = React.useState(false);
  const [collectionStarError, setCollectionStarError] = React.useState<string | null>(null);
  const [itemStarredMap, setItemStarredMap] = React.useState<Record<number, boolean>>({});
  const [updatingItemStars, setUpdatingItemStars] = React.useState<Record<number, boolean>>({});
  const [itemStarError, setItemStarError] = React.useState<string | null>(null);
  const showAuthenticatedCtas =
    authStatus === "authenticated" && isAuthenticated;

  const loadCollection = React.useCallback(async () => {
    if (!collectionId) {
      setCollectionState({
        status: "error",
        error: "Collection ID was not provided."
      });
      return;
    }

    setCollectionState({
      status: "loading"
    });

    try {
      const data = await publicCollectionApi.get(collectionId);
      setCollectionState({
        status: "ready",
        data
      });
    } catch (error) {
      setCollectionState({
        status: "error",
        error: isApiError(error)
          ? error.detail
          : "We couldn't load this collection."
      });
    }
  }, [collectionId]);

  React.useEffect(() => {
    void loadCollection();
  }, [loadCollection]);

  React.useEffect(() => {
    if (!collectionId) {
      setItemsState({
        status: "error",
        data: [],
        error: "Collection ID was not provided.",
        hasMore: false
      });
      return;
    }

    let isActive = true;
    const handle = setTimeout(() => {
      void (async () => {
        setItemsState({
          status: "loading",
          data: [],
          error: undefined,
          hasMore: false
        });
        setLoadMoreError(null);

        try {
          const data = await publicItemApi.list(collectionId, {
            search: search.trim() || undefined,
            sort,
            offset: 0,
            limit: PAGE_SIZE
          });
          if (!isActive) {
            return;
          }
          setItemsState({
            status: "ready",
            data,
            hasMore: data.length === PAGE_SIZE
          });
        } catch (error) {
          if (!isActive) {
            return;
          }
          setItemsState({
            status: "error",
            data: [],
            error: isApiError(error)
              ? error.detail
              : "We couldn't load items in this collection.",
            hasMore: false
          });
        }
      })();
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(handle);
    };
  }, [collectionId, search, sort, refreshKey]);

  const loadCollectionStarStatus = React.useCallback(async () => {
    if (!collectionId || !showAuthenticatedCtas) {
      setCollectionStarred(false);
      return;
    }
    try {
      const status = await starsApi.collectionStatus(collectionId);
      setCollectionStarred(status.starred);
      setCollectionState((prev) => {
        if (prev.status !== "ready" || !prev.data) {
          return prev;
        }
        return {
          ...prev,
          data: {
            ...prev.data,
            star_count: status.star_count
          }
        };
      });
    } catch (error) {
      if (!isApiError(error) || error.status !== 404) {
        setCollectionStarError(
          isApiError(error) ? error.detail : "We couldn't update star status."
        );
      }
    }
  }, [collectionId, showAuthenticatedCtas]);

  React.useEffect(() => {
    void loadCollectionStarStatus();
  }, [loadCollectionStarStatus]);

  const itemIds = React.useMemo(
    () => itemsState.data.map((item) => item.id),
    [itemsState.data]
  );

  React.useEffect(() => {
    if (!collectionId || !showAuthenticatedCtas || itemsState.status !== "ready") {
      setItemStarredMap({});
      return;
    }

    let isActive = true;
    void (async () => {
      const statuses = await Promise.all(
        itemIds.map(async (itemId) => {
          try {
            const status = await starsApi.itemStatus(collectionId, itemId);
            return { itemId, status };
          } catch {
            return { itemId, status: null };
          }
        })
      );
      if (!isActive) {
        return;
      }
      const nextMap: Record<number, boolean> = {};
      statuses.forEach(({ itemId, status }) => {
        nextMap[itemId] = Boolean(status?.starred);
      });
      setItemStarredMap(nextMap);
    })();

    return () => {
      isActive = false;
    };
  }, [collectionId, itemIds, itemsState.status, showAuthenticatedCtas]);

  const handleRefresh = () => {
    void loadCollection();
    void loadCollectionStarStatus();
    setCollectionStarError(null);
    setItemStarError(null);
    setRefreshKey((prev) => prev + 1);
  };

  const handleToggleCollectionStar = async () => {
    if (!collectionId || !showAuthenticatedCtas || isUpdatingCollectionStar) {
      return;
    }
    setCollectionStarError(null);
    setIsUpdatingCollectionStar(true);
    try {
      const status = collectionStarred
        ? await starsApi.unstarCollection(collectionId)
        : await starsApi.starCollection(collectionId);
      setCollectionStarred(status.starred);
      setCollectionState((prev) => {
        if (prev.status !== "ready" || !prev.data) {
          return prev;
        }
        return {
          ...prev,
          data: {
            ...prev.data,
            star_count: status.star_count
          }
        };
      });
    } catch (error) {
      setCollectionStarError(
        isApiError(error) ? error.detail : "We couldn't update stars."
      );
    } finally {
      setIsUpdatingCollectionStar(false);
    }
  };

  const handleToggleItemStar = async (itemId: number) => {
    if (!collectionId || !showAuthenticatedCtas || updatingItemStars[itemId]) {
      return;
    }
    setItemStarError(null);
    const currentlyStarred = Boolean(itemStarredMap[itemId]);
    setUpdatingItemStars((prev) => ({
      ...prev,
      [itemId]: true
    }));
    try {
      const status = currentlyStarred
        ? await starsApi.unstarItem(collectionId, itemId)
        : await starsApi.starItem(collectionId, itemId);
      setItemStarredMap((prev) => ({
        ...prev,
        [itemId]: status.starred
      }));
      setItemsState((prev) => {
        if (prev.status !== "ready") {
          return prev;
        }
        return {
          ...prev,
          data: prev.data.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  star_count: status.star_count
                }
              : item
          )
        };
      });
    } catch (error) {
      setItemStarError(
        isApiError(error) ? error.detail : "We couldn't update stars."
      );
    } finally {
      setUpdatingItemStars((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  };

  const handleLoadMore = async () => {
    if (!collectionId) {
      return;
    }
    if (itemsState.status !== "ready" || !itemsState.hasMore || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const data = await publicItemApi.list(collectionId, {
        search: search.trim() || undefined,
        sort,
        offset: itemsState.data.length,
        limit: PAGE_SIZE
      });
      setItemsState((prev) => ({
        ...prev,
        data: [...prev.data, ...data],
        hasMore: data.length === PAGE_SIZE
      }));
    } catch (error) {
      setLoadMoreError(
        isApiError(error)
          ? error.detail
          : "We couldn't load more items."
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  const itemCount = itemsState.data.length;
  const filteredItems = itemsState.data.filter((item) => {
    if (filterImages) {
      if (!item.primary_image_id) {
        return false;
      }
    }
    if (filterHighlight && !item.is_highlight) {
      return false;
    }
    return true;
  });

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <header className="border-b border-stone-200/80 bg-stone-50/80 px-6 py-6 backdrop-blur lg:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Antique Catalogue"
              width={44}
              height={44}
              className="rounded-full"
            />
            <div>
              <p className="font-display text-lg tracking-tight">
                {t("Antique Catalogue")}
              </p>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                {t("Studio Archive")}
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-stone-600 md:flex">
            <Link href="/" className="hover:text-stone-900">
              {t("Home")}
            </Link>
            <Link href="/explore" className="font-medium text-stone-900">
              {t("Explore")}
            </Link>
            <Link href="/dashboard" className="hover:text-stone-900">
              {t("Dashboard")}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {showAuthenticatedCtas ? (
              <Button
                variant="secondary"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? t("Logging out...") : t("Log out")}
              </Button>
            ) : (
              <>
                <Button variant="ghost" className="hidden sm:inline-flex" asChild>
                  <Link href="/login">{t("Log in")}</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">{t("Create account")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-amber-300/20 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-64 w-64 rounded-full bg-stone-900/10 blur-[120px]" />
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-10 pt-8 lg:px-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/explore">
                <ArrowLeft className="h-4 w-4" />
                {t("Back to explore")}
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {showAuthenticatedCtas ? (
                <Button
                  variant={collectionStarred ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleToggleCollectionStar}
                  disabled={isUpdatingCollectionStar}
                >
                  <Star className={`h-4 w-4 ${collectionStarred ? "fill-current" : ""}`} />
                  {collectionStarred ? t("Starred") : t("Star")}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCcw className="h-4 w-4" />
                {t("Refresh")}
              </Button>
            </div>
          </div>
          {collectionStarError ? (
            <p className="text-sm text-rose-600">{t(collectionStarError)}</p>
          ) : null}
          {itemStarError ? (
            <p className="text-sm text-rose-600">{t(itemStarError)}</p>
          ) : null}

          {collectionState.status === "loading" ? (
            <div
              className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
              aria-busy="true"
            >
              {t("Loading collection details...")}
            </div>
          ) : collectionState.status === "error" ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
              <p className="text-sm font-medium text-rose-700">
                {t("We hit a snag loading this collection.")}
              </p>
              <p className="mt-2 text-sm text-rose-600">
                {t(collectionState.error ?? "Please try again.")}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleRefresh}>
                  {t("Try again")}
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/explore">{t("Back to explore")}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
                  {t("Public collection")}
                </p>
                <h1 className="font-display mt-4 text-3xl text-stone-900">
                  {collectionState.data?.name}
                </h1>
                {collectionState.data?.owner_username ? (
                  <p className="mt-2 text-sm text-stone-600">
                    {t("By")}{" "}
                    <Link
                      href={`/profile/${encodeURIComponent(collectionState.data.owner_username)}`}
                      className="font-medium text-amber-700 hover:text-amber-800"
                    >
                      @{collectionState.data.owner_username}
                    </Link>
                  </p>
                ) : null}
                <p className="mt-3 max-w-2xl text-sm text-stone-600">
                  {collectionState.data?.description ??
                    t("This collection is ready to explore.")}
                </p>
                <div className="mt-6 flex flex-wrap gap-4 text-sm text-stone-600">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    <Globe2 className="h-3.5 w-3.5" />
                    {t("Public access")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                    {t("{count} items loaded", { count: itemCount })}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                    <Star className="h-3.5 w-3.5 text-amber-600" />
                    {t("{count} stars", {
                      count: collectionState.data?.star_count ?? 0
                    })}
                  </span>
                </div>
              </div>

              <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  {t("Collection timeline")}
                </p>
                <div className="mt-6 space-y-4 text-sm text-stone-600">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-stone-900">{t("Created")}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {formatDate(collectionState.data?.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                      <RefreshCcw className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-stone-900">{t("Last updated")}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {formatDate(collectionState.data?.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 rounded-2xl border border-stone-900/90 bg-stone-950 px-4 py-3 text-stone-100">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                    {t("Explore more")}
                  </p>
                  <p className="mt-2 text-sm text-stone-300">
                    {t("Browse other public catalogues for inspiration.")}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-4"
                    asChild
                  >
                    <Link href="/explore">{t("Back to directory")}</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              {t("Items")}
            </p>
            <h2 className="font-display mt-3 text-2xl text-stone-900">
              {t("Collection items")}
            </h2>
          </div>
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-center">
            <div className="relative w-full lg:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                placeholder={t("Search items")}
                className="h-10 w-full rounded-full border border-stone-200 bg-white/90 pl-9 pr-3 text-sm text-stone-700 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 lg:ml-auto lg:w-auto lg:justify-end">
              <select
                className="h-10 rounded-full border border-stone-200 bg-white/90 px-3 text-sm text-stone-700 shadow-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-3 py-2 text-stone-600 shadow-sm">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-amber-500"
                    checked={filterImages}
                    onChange={(event) => setFilterImages(event.target.checked)}
                  />
                  {t("With images")}
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-amber-200/60 bg-amber-50/70 px-3 py-2 text-amber-700 shadow-sm">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-amber-500"
                    checked={filterHighlight}
                    onChange={(event) => setFilterHighlight(event.target.checked)}
                  />
                  {t("Spotlight")}
                </label>
              </div>
            </div>
          </div>
        </div>

        {itemsState.status === "loading" ? (
          <div
            className="mt-6 rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
            aria-busy="true"
          >
            {t("Loading items...")}
          </div>
        ) : itemsState.status === "error" ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
            <p className="text-sm font-medium text-rose-700">
              {t("We hit a snag loading items.")}
            </p>
            <p className="mt-2 text-sm text-rose-600">
              {t(itemsState.error ?? "Please try again.")}
            </p>
            <div className="mt-4">
              <Button variant="outline" onClick={handleRefresh}>
                {t("Try again")}
              </Button>
            </div>
          </div>
        ) : itemsState.data.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-stone-200 bg-white/80 p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  {t("No items yet")}
                </p>
                <h3 className="font-display mt-3 text-2xl text-stone-900">
                  {t("This collection does not have public items.")}
                </h3>
                <p className="mt-3 max-w-xl text-sm text-stone-600">
                  {t("Check back later or browse another public collection.")}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button variant="outline" onClick={handleRefresh}>
                    {t("Refresh items")}
                  </Button>
                  <Button asChild>
                    <Link href="/explore">{t("Browse directory")}</Link>
                  </Button>
                </div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Globe2 className="h-8 w-8" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredItems.length === 0 ? (
              <div className="rounded-3xl border border-stone-200 bg-white/80 p-8">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                      {t("No matches")}
                    </p>
                    <h3 className="font-display mt-3 text-2xl text-stone-900">
                      {t("No items match these filters.")}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm text-stone-600">
                      {t("Try adjusting your filters or clearing them to see more items.")}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFilterImages(false);
                          setFilterHighlight(false);
                        }}
                      >
                        {t("Clear filters")}
                      </Button>
                      <Button variant="ghost" onClick={() => setSearch("")}>
                        {t("Clear search")}
                      </Button>
                    </div>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <Globe2 className="h-8 w-8" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredItems.map((item) => {
                  const metadataEntries = Object.entries(item.metadata ?? {});
                  const imageId = item.primary_image_id ?? null;
                  const starCount = item.star_count ?? 0;
                  const itemIsStarred = Boolean(itemStarredMap[item.id]);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm",
                        item.is_highlight ? highlightCardClass : null
                      )}
                    >
                      {imageId ? (
                        <button
                          type="button"
                          className="mb-4 w-full overflow-hidden rounded-2xl border border-stone-100 bg-stone-50"
                          onClick={() =>
                            setLightboxImage({
                              src: imageApi.url(imageId, "original"),
                              alt: item.name
                            })
                          }
                        >
                          <img
                            src={imageApi.url(imageId, "medium")}
                            alt={item.name}
                            className="block h-48 w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ) : null}
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                            {t("Item")}
                          </p>
                          <h3 className="mt-3 text-xl font-semibold text-stone-900">
                            {item.name}
                          </h3>
                          {item.owner_username ? (
                            <p className="mt-2 text-xs text-stone-500">
                              {t("By")}{" "}
                              <Link
                                href={`/profile/${encodeURIComponent(item.owner_username)}`}
                                className="font-medium text-amber-700 hover:text-amber-800"
                              >
                                @{item.owner_username}
                              </Link>
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span>
                            {t("Added {date}", { date: formatDate(item.created_at) })}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500">
                            <Star className="h-3 w-3 text-amber-600" />
                            {starCount}
                          </span>
                        </div>
                      </div>
                      {item.notes ? (
                        <p className="mt-3 text-sm text-stone-600">
                          {truncate(item.notes, 160)}
                        </p>
                      ) : null}
                      <div className="mt-4 rounded-2xl border border-stone-100 bg-stone-50 p-4 text-sm text-stone-600">
                        {metadataEntries.length === 0 ? (
                          <p className="text-xs text-stone-500">
                            {t("No metadata shared.")}
                          </p>
                        ) : (
                          <div className="space-y-2 text-xs">
                            {metadataEntries.slice(0, 3).map(([key, value]) => (
                              <div
                                key={key}
                                className="flex items-center justify-between gap-3"
                              >
                                <span className="font-medium text-stone-700">
                                  {key}
                                </span>
                                <span className="text-stone-500">
                                  {formatMetadataValue(value)}
                                </span>
                              </div>
                            ))}
                            {metadataEntries.length > 3 ? (
                              <p className="text-xs text-stone-400">
                                {t("+{count} more fields", {
                                  count: metadataEntries.length - 3
                                })}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                      {showAuthenticatedCtas ? (
                        <div className="mt-4 flex justify-end">
                          <Button
                            size="sm"
                            variant={itemIsStarred ? "secondary" : "outline"}
                            disabled={Boolean(updatingItemStars[item.id])}
                            onClick={() => handleToggleItemStar(item.id)}
                          >
                            <Star
                              className={`h-4 w-4 ${itemIsStarred ? "fill-current" : ""}`}
                            />
                            {itemIsStarred ? t("Starred") : t("Star")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-col items-center gap-3">
              {loadMoreError ? (
                <p className="text-xs text-rose-600">{t(loadMoreError)}</p>
              ) : null}
              {itemsState.hasMore ? (
                <Button
                  variant="outline"
                  disabled={isLoadingMore}
                  onClick={handleLoadMore}
                >
                  {isLoadingMore
                    ? t("Loading more...")
                    : t("Load more items")}
                </Button>
              ) : (
                <p className="text-xs text-stone-500">
                  {t("You have reached the end of the list.")}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <Lightbox
        open={Boolean(lightboxImage)}
        src={lightboxImage?.src ?? null}
        alt={lightboxImage?.alt}
        onClose={() => setLightboxImage(null)}
      />
    </main>
  );
}

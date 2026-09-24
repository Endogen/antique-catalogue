"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Globe2,
  RefreshCcw,
  Search,
  Star
} from "lucide-react";

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData
} from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ItemPreviewCard } from "@/components/item-preview-card";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { PublicHeader } from "@/components/public-header";
import { SocialShareActions } from "@/components/social-share-actions";
import {
  isApiError,
  imageApi,
  publicCollectionApi,
  publicItemApi,
  starsApi,
  type CollectionResponse,
  type ItemResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { formatMetadataNumber } from "@/lib/format";
import { Card, EmptyState } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

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

const highlightCardClass =
  "border-brand ring-2 ring-ring/70 shadow-[0_0_0_1px_hsl(var(--brand)/0.85),0_0_28px_2px_hsl(var(--brand)/0.25)]";

export default function PublicCollectionPage() {
  const { isAuthenticated, status: authStatus } = useAuth();
  const params = useParams();
  const { t, tc, locale } = useI18n();
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
        return formatMetadataNumber(locale, value);
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

  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState(sortOptions[0]?.value ?? "-created_at");
  const [filterImages, setFilterImages] = React.useState(false);
  const [filterHighlight, setFilterHighlight] = React.useState(false);
  const [collectionStarred, setCollectionStarred] = React.useState(false);
  const [isUpdatingCollectionStar, setIsUpdatingCollectionStar] = React.useState(false);
  const [collectionStarError, setCollectionStarError] = React.useState<string | null>(null);
  const [itemStarredMap, setItemStarredMap] = React.useState<Record<number, boolean>>({});
  const [updatingItemStars, setUpdatingItemStars] = React.useState<Record<number, boolean>>({});
  const [itemStarError, setItemStarError] = React.useState<string | null>(null);
  const showAuthenticatedCtas =
    authStatus === "authenticated" && isAuthenticated;

  const numericCollectionId = Number(collectionId);
  const hasCollectionId = Boolean(collectionId) && Number.isFinite(numericCollectionId);
  const debouncedSearch = useDebouncedValue(search, 300).trim();

  const collectionQuery = useQuery({
    queryKey: queryKeys.explore.collection(numericCollectionId),
    queryFn: ({ signal }) =>
      publicCollectionApi.get(numericCollectionId, { signal }),
    enabled: hasCollectionId
  });
  const collectionState = toLoadState<CollectionResponse | undefined>(
    collectionQuery,
    "We couldn't load this collection.",
    undefined
  );
  const { refetch: refetchCollection } = collectionQuery;
  const loadCollection = React.useCallback(() => {
    void refetchCollection();
  }, [refetchCollection]);

  // Paging is owned by react-query: each page is keyed by collection, search
  // and sort, so changing any of them cancels the previous fetch instead of
  // letting a late response append to the wrong list.
  const itemsQuery = useInfiniteQuery({
    queryKey: [
      ...queryKeys.explore.collectionItems(numericCollectionId),
      debouncedSearch,
      sort
    ],
    enabled: hasCollectionId,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      publicItemApi.list(numericCollectionId, {
        search: debouncedSearch || undefined,
        sort,
        offset: pageParam,
        limit: PAGE_SIZE,
        signal
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined
  });

  const loadedItems = React.useMemo(
    () => itemsQuery.data?.pages.flat() ?? [],
    [itemsQuery.data]
  );
  const itemsState: ItemsState = {
    status: itemsQuery.isError
      ? "error"
      : itemsQuery.isPending
        ? "loading"
        : "ready",
    data: loadedItems,
    hasMore: Boolean(itemsQuery.hasNextPage),
    error: itemsQuery.isError
      ? isApiError(itemsQuery.error)
        ? itemsQuery.error.detail
        : "We couldn't load items in this collection."
      : undefined
  };
  // Star toggles patch the cached entries directly, so the visible counts
  // update without refetching the whole collection.
  const applyCollectionStarCount = React.useCallback(
    (starCount: number) => {
      queryClient.setQueryData<CollectionResponse | undefined>(
        queryKeys.explore.collection(numericCollectionId),
        (previous) =>
          previous ? { ...previous, star_count: starCount } : previous
      );
    },
    [queryClient, numericCollectionId]
  );

  const applyItemStarCount = React.useCallback(
    (itemId: number, starCount: number) => {
      queryClient.setQueriesData<InfiniteData<ItemResponse[]>>(
        {
          queryKey: queryKeys.explore.collectionItems(numericCollectionId)
        },
        (previous) =>
          previous
            ? {
                ...previous,
                pages: previous.pages.map((page) =>
                  page.map((item) =>
                    item.id === itemId
                      ? { ...item, star_count: starCount }
                      : item
                  )
                )
              }
            : previous
      );
    },
    [queryClient, numericCollectionId]
  );

  const isLoadingMore = itemsQuery.isFetchingNextPage;
  const loadMoreError =
    itemsQuery.isError && loadedItems.length > 0
      ? isApiError(itemsQuery.error)
        ? itemsQuery.error.detail
        : "We couldn't load more items."
      : null;


  const loadCollectionStarStatus = React.useCallback(async () => {
    if (!collectionId || !showAuthenticatedCtas) {
      setCollectionStarred(false);
      return;
    }
    try {
      const status = await starsApi.collectionStatus(collectionId);
      setCollectionStarred(status.starred);
      applyCollectionStarCount(status.star_count);
    } catch (error) {
      if (!isApiError(error) || error.status !== 404) {
        setCollectionStarError(
          isApiError(error) ? error.detail : "We couldn't update star status."
        );
      }
    }
  }, [applyCollectionStarCount, collectionId, showAuthenticatedCtas]);

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
    void itemsQuery.refetch();
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
      applyCollectionStarCount(status.star_count);
      void ((prev: unknown) => {
        void prev;
        return null;
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
      applyItemStarCount(itemId, status.star_count);
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

  const handleLoadMore = () => {
    if (!itemsQuery.hasNextPage || itemsQuery.isFetchingNextPage) {
      return;
    }
    void itemsQuery.fetchNextPage();
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-amber-300/20 blur-[100px]" />
      <div className="pointer-events-none absolute top-[35%] left-[-8%] h-72 w-72 rounded-full bg-amber-200/25 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-8%] h-80 w-80 rounded-full bg-panel/10 blur-[160px]" />
      <div className="relative z-10">
        <PublicHeader />

        <section>
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-10 pt-8 lg:px-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Button variant="ghost" size="sm" className="-ml-3" asChild>
              <Link href="/explore">
                <ArrowLeft className="h-4 w-4" />
                {t("Back to explore")}
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {showAuthenticatedCtas ? (
                <Button
                  variant="outline"
                  size="sm"
                  className={
                    collectionStarred
                      ? "w-9 px-0 border-brand-border text-brand"
                      : "w-9 px-0"
                  }
                  onClick={handleToggleCollectionStar}
                  disabled={isUpdatingCollectionStar}
                  aria-label={collectionStarred ? t("Starred") : t("Star")}
                  title={collectionStarred ? t("Starred") : t("Star")}
                >
                  <Star className={`h-4 w-4 ${collectionStarred ? "fill-current" : ""}`} />
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="w-9 px-0"
                onClick={handleRefresh}
                aria-label={t("Refresh")}
                title={t("Refresh")}
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <SocialShareActions
                path={collectionId ? `/explore/${collectionId}` : null}
                title={
                  collectionState.status === "ready" && collectionState.data
                    ? collectionState.data.name
                    : t("Public collection")
                }
                text={
                  collectionState.status === "ready" && collectionState.data
                    ? collectionState.data.description
                    : undefined
                }
                iconOnly
                copyFirst
              />
            </div>
          </div>
          {collectionStarError ? (
            <p className="text-sm text-destructive">{t(collectionStarError)}</p>
          ) : null}
          {itemStarError ? (
            <p className="text-sm text-destructive">{t(itemStarError)}</p>
          ) : null}

          {collectionState.status === "loading" ? (
            <EmptyState
              aria-busy="true">
              {t("Loading collection details...")}
            </EmptyState>
          ) : collectionState.status === "error" ? (
            <Alert className="rounded-3xl p-6">
              <p className="text-sm font-medium text-destructive">
                {t("We hit a snag loading this collection.")}
              </p>
              <p className="mt-2 text-sm text-destructive">
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
            </Alert>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card>
                <Eyebrow tone="brand" spacing="wide">
                  {t("Public collection")}
                </Eyebrow>
                <SectionHeading as="h1" size="xl" className="mt-4">
                  {collectionState.data?.name}
                </SectionHeading>
                {collectionState.data?.owner_username ? (
                  <p className="mt-2 text-sm text-muted-strong">
                    {t("By")}{" "}
                    <Link
                      href={`/profile/${encodeURIComponent(collectionState.data.owner_username)}`}
                      className="font-medium text-brand hover:text-brand-strong"
                    >
                      @{collectionState.data.owner_username}
                    </Link>
                  </p>
                ) : null}
                <p className="mt-3 max-w-2xl text-sm text-muted-strong">
                  {collectionState.data?.description ??
                    t("This collection is ready to explore.")}
                </p>
                <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-strong">
                  <span className="inline-flex items-center gap-2 rounded-full border border-success-border bg-success-muted px-3 py-1 text-xs font-medium text-success">
                    <Globe2 className="h-3.5 w-3.5" />
                    {t("Public access")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-strong">
                    {tc(itemCount, "{count} item loaded", "{count} items loaded")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-strong">
                    <Star className="h-3.5 w-3.5 text-brand" />
                    {tc(collectionState.data?.star_count ?? 0, "{count} star", "{count} stars")}
                  </span>
                </div>
              </Card>

              <Card tone="subtle">
                <Eyebrow>
                  {t("Collection timeline")}
                </Eyebrow>
                <div className="mt-6 space-y-4 text-sm text-muted-strong">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{t("Created")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(collectionState.data?.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                      <RefreshCcw className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{t("Last updated")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(collectionState.data?.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
        <div className="space-y-4">
          <div>
            <Eyebrow>
              {t("Items")}
            </Eyebrow>
            <SectionHeading className="mt-3">
              {t("Collection items")}
            </SectionHeading>
          </div>
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-center">
            <div className="relative w-full lg:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
              <input
                type="search"
                placeholder={t("Search items")}
                className="h-10 w-full rounded-full border border-border bg-card/90 pl-9 pr-3 text-sm text-muted-strong shadow-xs transition focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 lg:ml-auto lg:w-auto lg:justify-end">
              <select
                className="h-10 rounded-full border border-border bg-card/90 px-3 text-sm text-muted-strong shadow-xs focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring"
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
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-2 text-muted-strong shadow-xs">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-brand"
                    checked={filterImages}
                    onChange={(event) => setFilterImages(event.target.checked)}
                  />
                  {t("With images")}
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-brand-border/60 bg-brand-muted/70 px-3 py-2 text-brand shadow-xs">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-brand"
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
          <EmptyState
            className="mt-6"
            aria-busy="true">
            {t("Loading items...")}
          </EmptyState>
        ) : itemsState.status === "error" ? (
          <Alert className="rounded-3xl p-6 mt-6">
            <p className="text-sm font-medium text-destructive">
              {t("We hit a snag loading items.")}
            </p>
            <p className="mt-2 text-sm text-destructive">
              {t(itemsState.error ?? "Please try again.")}
            </p>
            <div className="mt-4">
              <Button variant="outline" onClick={handleRefresh}>
                {t("Try again")}
              </Button>
            </div>
          </Alert>
        ) : itemsState.data.length === 0 ? (
          <Card tone="subtle" padding="lg" className="mt-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <Eyebrow>
                  {t("No items yet")}
                </Eyebrow>
                <SectionHeading as="h3" className="mt-3">
                  {t("This collection does not have public items.")}
                </SectionHeading>
                <p className="mt-3 max-w-xl text-sm text-muted-strong">
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                <Globe2 className="h-8 w-8" />
              </div>
            </div>
          </Card>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredItems.length === 0 ? (
              <Card tone="subtle" padding="lg">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div>
                    <Eyebrow>
                      {t("No matches")}
                    </Eyebrow>
                    <SectionHeading as="h3" className="mt-3">
                      {t("No items match these filters.")}
                    </SectionHeading>
                    <p className="mt-3 max-w-xl text-sm text-muted-strong">
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
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                    <Globe2 className="h-8 w-8" />
                  </div>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredItems.map((item) => {
                  const metadataEntries = Object.entries(item.metadata ?? {});
                  const imageId = item.primary_image_id ?? null;
                  const imageCount = item.image_count ?? 0;
                  const starCount = item.star_count ?? 0;
                  const itemIsStarred = Boolean(itemStarredMap[item.id]);
                  const imageLabel =
                    tc(imageCount, "{count} image", "{count} images");
                  const metadata = metadataEntries
                    .slice(0, 4)
                    .map(([key, value]) => ({
                      label: key,
                      value: formatMetadataValue(value)
                    }));
                  return (
                    <ItemPreviewCard
                      key={item.id}
                      href={`/explore/${collectionId}/items/${item.id}`}
                      title={item.name}
                      eyebrow={t("Item")}
                      createdLabel={t("Added {date}", {
                        date: formatDate(item.created_at)
                      })}
                      description={item.notes}
                      descriptionFallback={t("No description provided.")}
                      metadata={metadata}
                      metadataFallback={t("No metadata shared.")}
                      metadataOverflowLabel={tc(Math.max(metadataEntries.length - 2, 0), "+{count} more field", "+{count} more fields")}
                      imageSrc={imageId ? imageApi.url(imageId, "medium") : null}
                      imageAlt={item.name}
                      imageFallbackLabel={t("No image")}
                      starCount={starCount}
                      imageCount={imageCount}
                      imageCountLabel={imageLabel}
                      isHighlighted={item.is_highlight}
                      highlightClassName={highlightCardClass}
                      onToggleStar={
                        showAuthenticatedCtas
                          ? () => {
                              void handleToggleItemStar(item.id);
                            }
                          : undefined
                      }
                      isStarred={itemIsStarred}
                      starDisabled={Boolean(updatingItemStars[item.id])}
                      openLabel={t("Open")}
                    />
                  );
                })}
              </div>
            )}
            <div className="flex flex-col items-center gap-3">
              {loadMoreError ? (
                <p className="text-xs text-destructive">{t(loadMoreError)}</p>
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
                <p className="text-xs text-muted-foreground">
                  {t("You have reached the end of the list.")}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      </div>
    </main>
  );
}

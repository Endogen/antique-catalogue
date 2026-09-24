"use client";

import { CollectionArchive } from "@/components/collection-archive";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  FileEdit,
  Plus,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Star,
  Tag,
  X,
} from "lucide-react";

import { ItemPreviewCard } from "@/components/item-preview-card";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData
} from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  collectionApi,
  fieldApi,
  imageApi,
  isApiError,
  itemApi,
  speedCaptureApi,
  starsApi,
  type CollectionResponse,
  type FieldDefinitionResponse,
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

type FilterEntry = {
  id: string;
  fieldId: number;
  fieldName: string;
  value: string;
};

const PAGE_SIZE = 12;

const buildBaseSortOptions = (t: (key: string) => string) => [
  { label: t("Newest first"), value: "-created_at" },
  { label: t("Oldest first"), value: "created_at" },
  { label: t("Name A to Z"), value: "name" },
  { label: t("Name Z to A"), value: "-name" }
];

const buildFieldTypeLabels = (t: (key: string) => string): Record<string, string> => ({
  text: t("Text"),
  number: t("Number"),
  date: t("Date"),
  timestamp: t("Timestamp"),
  checkbox: t("Checkbox"),
  select: t("Select")
});

const highlightCardClass =
  "border-brand ring-2 ring-ring/70 shadow-[0_0_0_1px_hsl(var(--brand)/0.85),0_0_28px_2px_hsl(var(--brand)/0.25)]";

const sortFields = (items: FieldDefinitionResponse[]) =>
  [...items].sort((a, b) => a.position - b.position || a.id - b.id);

const normalizeOptions = (values: string[]) => {
  const map = new Map<string, string>();
  values.forEach((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (!map.has(key)) {
      map.set(key, trimmed);
    }
  });
  return Array.from(map.values());
};

const extractOptions = (options?: { options?: unknown } | null) => {
  if (!options || !Array.isArray(options.options)) {
    return [];
  }
  return normalizeOptions(
    options.options.filter((value): value is string => typeof value === "string")
  );
};

export default function CollectionDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { t, tc, locale } = useI18n();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const baseSortOptions = React.useMemo(() => buildBaseSortOptions(t), [t]);
  const fieldTypeLabels = React.useMemo(() => buildFieldTypeLabels(t), [t]);

  const queryClient = useQueryClient();

  const collectionQuery = useQuery({
    queryKey: queryKeys.collections.detail(Number(collectionId)),
    queryFn: ({ signal }) => collectionApi.get(collectionId!, { signal }),
    enabled: Boolean(collectionId)
  });
  const fieldsQuery = useQuery({
    queryKey: queryKeys.collections.fields(Number(collectionId)),
    queryFn: ({ signal }) => fieldApi.list(collectionId!, { signal }),
    enabled: Boolean(collectionId)
  });

  const collectionState = toLoadState<CollectionResponse | undefined>(
    collectionQuery,
    "We couldn't load this collection.",
    undefined
  );
  const fieldsState = toLoadState<FieldDefinitionResponse[]>(
    fieldsQuery,
    "We couldn't load the schema fields.",
    []
  );

  const applyCollectionStarCount = React.useCallback(
    (starCount: number) => {
      queryClient.setQueryData<CollectionResponse | undefined>(
        queryKeys.collections.detail(Number(collectionId)),
        (previous) =>
          previous ? { ...previous, star_count: starCount } : previous
      );
    },
    [queryClient, collectionId]
  );

  const { refetch: refetchCollection } = collectionQuery;
  const { refetch: refetchFields } = fieldsQuery;
  const loadCollection = React.useCallback(() => {
    void refetchCollection();
  }, [refetchCollection]);
  const loadFields = React.useCallback(() => {
    void refetchFields();
  }, [refetchFields]);
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState("-created_at");
  const [filters, setFilters] = React.useState<FilterEntry[]>([]);
  // Below lg the filter form folds behind a toggle so the items stay near the top.
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [filterFieldId, setFilterFieldId] = React.useState("");
  const [filterValue, setFilterValue] = React.useState("");
  const [filterError, setFilterError] = React.useState<string | null>(null);
  const [collectionStarred, setCollectionStarred] = React.useState(false);
  const [isUpdatingCollectionStar, setIsUpdatingCollectionStar] = React.useState(false);
  const [collectionStarError, setCollectionStarError] = React.useState<string | null>(null);
  const [showDrafts, setShowDrafts] = React.useState(
    searchParams.get("include_drafts") === "true"
  );
  const filterIdRef = React.useRef(0);

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

  const sortedFields = React.useMemo(
    () => sortFields(fieldsState.data),
    [fieldsState.data]
  );

  const sortOptions = React.useMemo(() => {
    const metadataOptions = sortedFields.flatMap((field) => [
      {
        label: t("Metadata: {field} (asc)", { field: field.name }),
        value: `metadata:${field.name}`
      },
      {
        label: t("Metadata: {field} (desc)", { field: field.name }),
        value: `-metadata:${field.name}`
      }
    ]);
    return [...baseSortOptions, ...metadataOptions];
  }, [baseSortOptions, sortedFields, t]);

  const selectedField = React.useMemo(
    () =>
      sortedFields.find((field) => String(field.id) === String(filterFieldId)),
    [sortedFields, filterFieldId]
  );

  const selectedFieldOptions = React.useMemo(() => {
    if (!selectedField || selectedField.field_type !== "select") {
      return [];
    }
    return extractOptions(selectedField.options);
  }, [selectedField]);

  React.useEffect(() => {
    if (!selectedField) {
      setFilterValue("");
      return;
    }
    if (selectedField.field_type === "checkbox") {
      setFilterValue("true");
      return;
    }
    if (selectedField.field_type === "select") {
      setFilterValue(selectedFieldOptions[0] ?? "");
      return;
    }
    setFilterValue("");
  }, [selectedField, selectedFieldOptions]);

  React.useEffect(() => {
    setFilterError(null);
  }, [filterFieldId, filterValue]);



  const loadCollectionStarStatus = React.useCallback(async () => {
    if (!collectionId) {
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
  }, [applyCollectionStarCount, collectionId]);

  React.useEffect(() => {
    void loadCollectionStarStatus();
  }, [loadCollectionStarStatus]);

  // Keyed under the collections root, so publishing or capturing a draft
  // refreshes the badge through the usual invalidation instead of only on a
  // manual refresh — and a slow response for a collection you have already
  // navigated away from can no longer land on the new one.
  const captureSessionQuery = useQuery({
    queryKey: queryKeys.collections.captureSession(Number(collectionId)),
    queryFn: ({ signal }) => speedCaptureApi.session(collectionId!, { signal }),
    enabled: Boolean(collectionId)
  });
  const draftCount = captureSessionQuery.data?.draft_count ?? null;

  const filterParams = React.useMemo(
    () => filters.map((filter) => `${filter.fieldName}=${filter.value}`),
    [filters]
  );

  const debouncedSearch = useDebouncedValue(search, 300).trim();

  // Paging lives in react-query: search, sort, filters and the draft toggle are
  // all part of the key, so changing any of them cancels the in-flight request
  // rather than letting a late response land on the new filter set.
  const itemsQuery = useInfiniteQuery({
    queryKey: [
      ...queryKeys.collections.items(Number(collectionId)),
      debouncedSearch,
      sort,
      filterParams,
      showDrafts
    ],
    enabled: Boolean(collectionId),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      itemApi.list(collectionId!, {
        search: debouncedSearch || undefined,
        sort,
        offset: pageParam,
        limit: PAGE_SIZE,
        filters: filterParams,
        includeDrafts: showDrafts,
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
  const isLoadingMore = itemsQuery.isFetchingNextPage;
  const loadMoreError =
    itemsQuery.isError && loadedItems.length > 0
      ? isApiError(itemsQuery.error)
        ? itemsQuery.error.detail
        : "We couldn't load more items."
      : null;


  const handleRefresh = () => {
    void loadCollection();
    void loadFields();
    void loadCollectionStarStatus();
    setCollectionStarError(null);
    void itemsQuery.refetch();
    void captureSessionQuery.refetch();
  };

  const handleToggleCollectionStar = async () => {
    if (!collectionId || isUpdatingCollectionStar) {
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
    } catch (error) {
      setCollectionStarError(
        isApiError(error) ? error.detail : "We couldn't update stars."
      );
    } finally {
      setIsUpdatingCollectionStar(false);
    }
  };

  const handleAddFilter = () => {
    if (!selectedField) {
      setFilterError("Select a field to filter.");
      return;
    }
    const trimmedValue = filterValue.trim();
    if (!trimmedValue) {
      setFilterError("Enter a value to filter.");
      return;
    }
    filterIdRef.current += 1;
    setFilters((prev) => [
      ...prev,
      {
        id: `filter-${filterIdRef.current}`,
        fieldId: selectedField.id,
        fieldName: selectedField.name,
        value: trimmedValue
      }
    ]);
    setFilterValue("");
    setFilterFieldId("");
  };

  const handleRemoveFilter = (id: string) => {
    setFilters((prev) => prev.filter((filter) => filter.id !== id));
  };

  const handleClearFilters = () => {
    setFilters([]);
  };

  const handleLoadMore = () => {
    if (!itemsQuery.hasNextPage || itemsQuery.isFetchingNextPage) {
      return;
    }
    void itemsQuery.fetchNextPage();
  };

  const itemCount = itemsState.data.length;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link href="/collections">
              <ArrowLeft className="h-4 w-4" />
              {t("Back to collections")}
            </Link>
          </Button>
          <div>
            <Eyebrow tone="brand" spacing="wide">
              {t("Collection overview")}
            </Eyebrow>
            <SectionHeading as="h1" size="xl" className="mt-4">
              {collectionState.status === "ready" && collectionState.data
                ? collectionState.data.name
                : t("Review collection items")}
            </SectionHeading>
            <p className="mt-3 max-w-2xl text-sm text-muted-strong">
              {t("Search, filter, and organize the items in this collection.")}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:gap-3">
          <Button className="grow px-3 sm:grow-0 sm:px-4" asChild>
            <Link href={`/collections/${collectionId}/items/new`}>
              <Plus className="h-4 w-4" />
              {t("Add item")}
            </Link>
          </Button>
          {(draftCount ?? 0) > 0 ? (
            <Button
              variant={showDrafts ? "secondary" : "outline"}
              className="grow px-3 sm:grow-0 sm:px-4"
              onClick={() => setShowDrafts((prev) => !prev)}
            >
              <FileEdit className="h-4 w-4" />
              {showDrafts
                ? t("Hide drafts")
                : tc(draftCount ?? 0, "{count} draft", "{count} drafts")}
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="w-10 px-0 sm:order-last"
            onClick={handleRefresh}
            aria-label={t("Refresh")}
            title={t("Refresh")}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button
            variant={collectionStarred ? "secondary" : "outline"}
            className="grow px-3 sm:grow-0 sm:px-4"
            onClick={handleToggleCollectionStar}
            disabled={isUpdatingCollectionStar}
          >
            <Star className={`h-4 w-4 ${collectionStarred ? "fill-current" : ""}`} />
            {collectionStarred ? t("Starred") : t("Star")}
          </Button>
          <CollectionArchive collectionId={collectionId} className="grow px-3 sm:grow-0 sm:px-4" />
        </div>
      </header>

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
              <Link href="/collections">{t("Back to collections")}</Link>
            </Button>
          </div>
        </Alert>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <Eyebrow>
              {t("Collection details")}
            </Eyebrow>
            <SectionHeading className="mt-3 hidden lg:block">
              {collectionState.data?.name}
            </SectionHeading>
            <p className="mt-3 text-sm text-muted-strong">
              {collectionState.data?.description ??
                t(
                  "Add a description to capture the story behind this collection."
                )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium ${
                  collectionState.data?.is_public
                    ? "border-success-border bg-success-muted text-success"
                    : "border-brand-border bg-brand-muted text-brand"
                }`}
              >
                {collectionState.data?.is_public ? t("Public") : t("Private")}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-muted-strong">
                {tc(itemCount, "{count} item loaded", "{count} items loaded")}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-muted-strong">
                <Star className="h-3.5 w-3.5 text-brand" />
                {tc(collectionState.data?.star_count ?? 0, "{count} star", "{count} stars")}
              </span>
            </div>
            {collectionStarError ? (
              <p className="mt-4 text-sm text-destructive">{t(collectionStarError)}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-strong">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand" />
                {t("Created {date}", {
                  date: formatDate(collectionState.data?.created_at)
                })}
              </span>
              <span className="inline-flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-brand" />
                {t("Updated {date}", {
                  date: formatDate(collectionState.data?.updated_at)
                })}
              </span>
            </div>
          </Card>

          <Card tone="subtle">
            <Eyebrow>
              {t("Schema snapshot")}
            </Eyebrow>
            {fieldsState.status === "loading" ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {t("Loading schema fields...")}
              </p>
            ) : fieldsState.status === "error" ? (
              <p className="mt-4 text-sm text-destructive">
                {t(fieldsState.error ?? "We couldn't load schema fields.")}
              </p>
            ) : fieldsState.data.length === 0 ? (
              <div className="mt-4 space-y-3 text-sm text-muted-strong">
                <p>{t("No schema fields yet.")}</p>
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/collections/${collectionId}/settings`}>
                    {t("Define schema")}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm text-muted-strong lg:mt-4 lg:block lg:space-y-3">
                <p>{tc(fieldsState.data.length, "{count} field defined.", "{count} fields defined.")}</p>
                <div className="hidden space-y-2 lg:block">
                  {sortedFields.slice(0, 4).map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="font-medium text-foreground">
                        {field.name}
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em] text-muted-subtle">
                        {fieldTypeLabels[field.field_type] ?? field.field_type}
                      </span>
                    </div>
                  ))}
                  {sortedFields.length > 4 ? (
                    <p className="text-xs text-muted-subtle">
                      {tc(sortedFields.length - 4, "+{count} more field", "+{count} more fields")}
                    </p>
                  ) : null}
                </div>
                <Button size="sm" variant="ghost" className="-mr-3 lg:-ml-3 lg:mr-0" asChild>
                  <Link href={`/collections/${collectionId}/settings`}>
                    {t("Edit schema")}
                  </Link>
                </Button>
              </div>
            )}
          </Card>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Eyebrow>
              {t("Items")}
            </Eyebrow>
            <SectionHeading className="mt-3">
              {t("Collection items")}
            </SectionHeading>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
              <input
                type="search"
                placeholder={t("Search items")}
                className="h-10 w-full rounded-full sm:w-56 border border-border bg-card/90 pl-9 pr-3 text-sm text-muted-strong shadow-xs transition focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex gap-2 sm:gap-3">
              <select
                aria-label={t("Sort items")}
                className="h-10 min-w-0 flex-1 rounded-full border border-border bg-card/90 px-3 text-sm text-muted-strong shadow-xs focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring sm:flex-none"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                variant={filtersOpen ? "secondary" : "outline"}
                className="rounded-full lg:hidden"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-controls="collection-filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {t("Filters")}
                {filters.length > 0 ? (
                  <span className="rounded-full bg-brand px-1.5 text-xs leading-5 text-brand-foreground tabular-nums">
                    {filters.length}
                  </span>
                ) : null}
              </Button>
            </div>
          </div>
        </div>

        <Card
          id="collection-filters"
          tone="subtle"
          className={filtersOpen ? undefined : "hidden lg:block"}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Eyebrow>
                {t("Filters")}
              </Eyebrow>
              <h3 className="mt-3 text-lg font-semibold text-foreground">
                {t("Refine by metadata")}
              </h3>
              <p className="mt-2 text-sm text-muted-strong">
                {t("Add filters using your schema field names and values.")}
              </p>
            </div>
            {filters.length > 0 ? (
              <Button size="sm" variant="ghost" onClick={handleClearFilters}>
                {t("Clear filters")}
              </Button>
            ) : null}
          </div>

          {fieldsState.status === "loading" ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("Loading available fields...")}
            </p>
          ) : fieldsState.status === "error" ? (
            <p className="mt-4 text-sm text-destructive">
              {t(fieldsState.error ?? "We couldn't load fields for filtering.")}
            </p>
          ) : fieldsState.data.length === 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-strong">
              <p>{t("Define schema fields before filtering items.")}</p>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/collections/${collectionId}/settings`}>
                  {t("Define schema")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[200px] flex-1 flex-col gap-2">
                  <label className="text-xs uppercase tracking-eyebrow text-muted-subtle">
                    {t("Field")}
                  </label>
                  <select
                    className="h-10 rounded-2xl border border-border bg-card/90 px-3 text-sm text-muted-strong shadow-xs focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring"
                    value={filterFieldId}
                    onChange={(event) => setFilterFieldId(event.target.value)}
                  >
                    <option value="">{t("Select a field")}</option>
                    {sortedFields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex min-w-[200px] flex-1 flex-col gap-2">
                  <label className="text-xs uppercase tracking-eyebrow text-muted-subtle">
                    {t("Value")}
                  </label>
                  {selectedField?.field_type === "select" ? (
                    <select
                      className="h-10 rounded-2xl border border-border bg-card/90 px-3 text-sm text-muted-strong shadow-xs focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring"
                      value={filterValue}
                      onChange={(event) => setFilterValue(event.target.value)}
                      disabled={selectedFieldOptions.length === 0}
                    >
                      <option value="">{t("Select a value")}</option>
                      {selectedFieldOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : selectedField?.field_type === "checkbox" ? (
                    <select
                      className="h-10 rounded-2xl border border-border bg-card/90 px-3 text-sm text-muted-strong shadow-xs focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring"
                      value={filterValue}
                      onChange={(event) => setFilterValue(event.target.value)}
                    >
                      <option value="true">{t("True")}</option>
                      <option value="false">{t("False")}</option>
                    </select>
                  ) : (
                    <input
                      type={
                        selectedField?.field_type === "number"
                          ? "number"
                          : selectedField?.field_type === "date"
                            ? "date"
                            : selectedField?.field_type === "timestamp"
                              ? "datetime-local"
                              : "text"
                      }
                      step={
                        selectedField?.field_type === "number" ? "any" : undefined
                      }
                      className="h-10 rounded-2xl border border-border bg-card/90 px-3 text-sm text-muted-strong shadow-xs transition focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring"
                      placeholder={t("Enter value")}
                      value={filterValue}
                      onChange={(event) => setFilterValue(event.target.value)}
                      disabled={!selectedField}
                    />
                  )}
                </div>
                <Button
                  variant="secondary"
                  className="h-10 w-full sm:w-auto"
                  onClick={handleAddFilter}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {t("Add filter")}
                </Button>
              </div>

              {filterError ? (
                <p className="text-sm text-destructive">{t(filterError)}</p>
              ) : null}

              {filters.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <span
                      key={filter.id}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-strong"
                    >
                      <Tag className="h-3.5 w-3.5 text-brand" />
                      <span className="font-medium text-muted-strong">
                        {filter.fieldName}
                      </span>
                      <span>=</span>
                      <span className="text-muted-foreground">{filter.value}</span>
                      <button
                        type="button"
                        className="text-muted-subtle transition hover:text-foreground"
                        onClick={() => handleRemoveFilter(filter.id)}
                        aria-label={t("Remove filter {name}", {
                          name: filter.fieldName
                        })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("No filters applied. Use the controls above to narrow the list.")}
                </p>
              )}
            </div>
          )}
        </Card>

        {itemsState.status === "loading" ? (
          <EmptyState
            aria-busy="true">
            {t("Loading items...")}
          </EmptyState>
        ) : itemsState.status === "error" ? (
          <Alert className="rounded-3xl p-6">
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
          <Card tone="subtle" padding="lg">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <Eyebrow>
                  {t("No items yet")}
                </Eyebrow>
                <SectionHeading as="h3" className="mt-3">
                  {t("Start capturing your first item.")}
                </SectionHeading>
                <p className="mt-3 max-w-xl text-sm text-muted-strong">
                  {t(
                    "Add an item to begin cataloguing metadata and imagery for this collection."
                  )}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href={`/collections/${collectionId}/items/new`}>
                      {t("Add item")}
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={handleRefresh}>
                    {t("Refresh items")}
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href={`/collections/${collectionId}/settings`}>
                      {t("Review schema")}
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                <Search className="h-8 w-8" />
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {itemsState.data.map((item) => {
                const metadataEntries = Object.entries(item.metadata ?? {});
                const imageCount = item.image_count ?? 0;
                const imageLabel =
                  tc(imageCount, "{count} image", "{count} images");
                const starCount = item.star_count ?? 0;
                const imageId = item.primary_image_id ?? null;
                const metadata = metadataEntries.slice(0, 4).map(([key, value]) => ({
                  label: key,
                  value: formatMetadataValue(value)
                }));
                return (
                  <ItemPreviewCard
                    key={item.id}
                    href={`/collections/${collectionId}/items/${item.id}`}
                    title={item.name}
                    eyebrow={item.is_draft ? t("Draft") : t("Item")}
                    createdLabel={t("Added {date}", {
                      date: formatDate(item.created_at)
                    })}
                    description={item.notes}
                    descriptionFallback={t("No description provided.")}
                    metadata={metadata}
                    metadataFallback={t("No metadata captured yet.")}
                    metadataOverflowLabel={tc(Math.max(metadataEntries.length - 2, 0), "+{count} more field", "+{count} more fields")}
                    imageSrc={imageId ? imageApi.url(imageId, "medium") : null}
                    imageAlt={item.name}
                    imageFallbackLabel={t("No image")}
                    starCount={starCount}
                    imageCount={imageCount}
                    imageCountLabel={imageLabel}
                    isHighlighted={item.is_highlight}
                    highlightClassName={highlightCardClass}
                    openLabel={t("Open")}
                  />
                );
              })}
            </div>
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
  );
}

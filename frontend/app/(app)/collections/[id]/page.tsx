"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Image as ImageIcon,
  Plus,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Star,
  Tag,
  X
} from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  collectionApi,
  fieldApi,
  isApiError,
  itemApi,
  starsApi,
  type CollectionResponse,
  type FieldDefinitionResponse,
  type ItemResponse
} from "@/lib/api";

type LoadState = {
  status: "loading" | "ready" | "error";
  data?: CollectionResponse;
  error?: string;
};

type FieldsState = {
  status: "loading" | "ready" | "error";
  data: FieldDefinitionResponse[];
  error?: string;
};

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

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
};

const highlightCardClass =
  "border-amber-400 ring-2 ring-amber-300/70 shadow-[0_0_0_1px_rgba(251,191,36,0.85),0_18px_36px_-20px_rgba(217,119,6,0.75)]";

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
  const { t, locale } = useI18n();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const baseSortOptions = React.useMemo(() => buildBaseSortOptions(t), [t]);
  const fieldTypeLabels = React.useMemo(() => buildFieldTypeLabels(t), [t]);

  const [collectionState, setCollectionState] = React.useState<LoadState>({
    status: "loading"
  });
  const [fieldsState, setFieldsState] = React.useState<FieldsState>({
    status: "loading",
    data: []
  });
  const [itemsState, setItemsState] = React.useState<ItemsState>({
    status: "loading",
    data: [],
    hasMore: false
  });
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState("-created_at");
  const [filters, setFilters] = React.useState<FilterEntry[]>([]);
  const [filterFieldId, setFilterFieldId] = React.useState("");
  const [filterValue, setFilterValue] = React.useState("");
  const [filterError, setFilterError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);
  const [collectionStarred, setCollectionStarred] = React.useState(false);
  const [isUpdatingCollectionStar, setIsUpdatingCollectionStar] = React.useState(false);
  const [collectionStarError, setCollectionStarError] = React.useState<string | null>(null);
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

  const loadCollection = React.useCallback(async () => {
    if (!collectionId) {
      setCollectionState({
        status: "error",
        error: "Collection ID was not provided."
      });
      return;
    }

    setCollectionState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));

    try {
      const data = await collectionApi.get(collectionId);
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

  const loadFields = React.useCallback(async () => {
    if (!collectionId) {
      setFieldsState({
        status: "error",
        data: [],
        error: "Collection ID was not provided."
      });
      return;
    }

    setFieldsState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));

    try {
      const data = await fieldApi.list(collectionId);
      setFieldsState({
        status: "ready",
        data
      });
    } catch (error) {
      setFieldsState({
        status: "error",
        data: [],
        error: isApiError(error)
          ? error.detail
          : "We couldn't load the schema fields."
      });
    }
  }, [collectionId]);

  React.useEffect(() => {
    void loadCollection();
    void loadFields();
  }, [loadCollection, loadFields]);

  const loadCollectionStarStatus = React.useCallback(async () => {
    if (!collectionId) {
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
  }, [collectionId]);

  React.useEffect(() => {
    void loadCollectionStarStatus();
  }, [loadCollectionStarStatus]);

  const filterParams = React.useMemo(
    () => filters.map((filter) => `${filter.fieldName}=${filter.value}`),
    [filters]
  );

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
          const data = await itemApi.list(collectionId, {
            search: search.trim() || undefined,
            sort,
            offset: 0,
            limit: PAGE_SIZE,
            filters: filterParams
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
  }, [collectionId, search, sort, filterParams, refreshKey]);

  const handleRefresh = () => {
    void loadCollection();
    void loadFields();
    void loadCollectionStarStatus();
    setCollectionStarError(null);
    setRefreshKey((prev) => prev + 1);
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
      const data = await itemApi.list(collectionId, {
        search: search.trim() || undefined,
        sort,
        offset: itemsState.data.length,
        limit: PAGE_SIZE,
        filters: filterParams
      });
      setItemsState((prev) => ({
        ...prev,
        data: [...prev.data, ...data],
        hasMore: data.length === PAGE_SIZE
      }));
    } catch (error) {
      setLoadMoreError(
        isApiError(error) ? error.detail : "We couldn't load more items."
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  const itemCount = itemsState.data.length;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/collections">
              <ArrowLeft className="h-4 w-4" />
              {t("Back to collections")}
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              {t("Collection overview")}
            </p>
            <h1 className="font-display mt-4 text-3xl text-stone-900">
              {collectionState.status === "ready" && collectionState.data
                ? collectionState.data.name
                : t("Review collection items")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-stone-600">
              {t("Search, filter, and organize the items in this collection.")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant={collectionStarred ? "secondary" : "outline"}
            onClick={handleToggleCollectionStar}
            disabled={isUpdatingCollectionStar}
          >
            <Star className={`h-4 w-4 ${collectionStarred ? "fill-current" : ""}`} />
            {collectionStarred ? t("Starred") : t("Star")}
          </Button>
          <Button asChild>
            <Link href={`/collections/${collectionId}/items/new`}>
              <Plus className="h-4 w-4" />
              {t("Add item")}
            </Link>
          </Button>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCcw className="h-4 w-4" />
            {t("Refresh")}
          </Button>
        </div>
      </header>

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
              <Link href="/collections">{t("Back to collections")}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              {t("Collection details")}
            </p>
            <h2 className="font-display mt-3 text-2xl text-stone-900">
              {collectionState.data?.name}
            </h2>
            <p className="mt-3 text-sm text-stone-600">
              {collectionState.data?.description ??
                t(
                  "Add a description to capture the story behind this collection."
                )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium ${
                  collectionState.data?.is_public
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {collectionState.data?.is_public ? t("Public") : t("Private")}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-stone-600">
                {t("{count} items loaded", { count: itemCount })}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-stone-600">
                <Star className="h-3.5 w-3.5 text-amber-600" />
                {t("{count} stars", {
                  count: collectionState.data?.star_count ?? 0
                })}
              </span>
            </div>
            {collectionStarError ? (
              <p className="mt-4 text-sm text-rose-600">{t(collectionStarError)}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-stone-600">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-600" />
                {t("Created {date}", {
                  date: formatDate(collectionState.data?.created_at)
                })}
              </span>
              <span className="inline-flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-amber-600" />
                {t("Updated {date}", {
                  date: formatDate(collectionState.data?.updated_at)
                })}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              {t("Schema snapshot")}
            </p>
            {fieldsState.status === "loading" ? (
              <p className="mt-4 text-sm text-stone-500">
                {t("Loading schema fields...")}
              </p>
            ) : fieldsState.status === "error" ? (
              <p className="mt-4 text-sm text-rose-600">
                {t(fieldsState.error ?? "We couldn't load schema fields.")}
              </p>
            ) : fieldsState.data.length === 0 ? (
              <div className="mt-4 space-y-3 text-sm text-stone-600">
                <p>{t("No schema fields yet.")}</p>
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/collections/${collectionId}/settings`}>
                    {t("Define schema")}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-stone-600">
                <p>{t("{count} fields defined.", { count: fieldsState.data.length })}</p>
                <div className="space-y-2">
                  {sortedFields.slice(0, 4).map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="font-medium text-stone-900">
                        {field.name}
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em] text-stone-400">
                        {fieldTypeLabels[field.field_type] ?? field.field_type}
                      </span>
                    </div>
                  ))}
                  {sortedFields.length > 4 ? (
                    <p className="text-xs text-stone-400">
                      {t("+{count} more fields", {
                        count: sortedFields.length - 4
                      })}
                    </p>
                  ) : null}
                </div>
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/collections/${collectionId}/settings`}>
                    {t("Edit schema")}
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              {t("Items")}
            </p>
            <h2 className="font-display mt-3 text-2xl text-stone-900">
              {t("Collection items")}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                placeholder={t("Search items")}
                className="h-10 w-56 rounded-full border border-stone-200 bg-white/90 pl-9 pr-3 text-sm text-stone-700 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
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
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                {t("Filters")}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-stone-900">
                {t("Refine by metadata")}
              </h3>
              <p className="mt-2 text-sm text-stone-600">
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
            <p className="mt-4 text-sm text-stone-500">
              {t("Loading available fields...")}
            </p>
          ) : fieldsState.status === "error" ? (
            <p className="mt-4 text-sm text-rose-600">
              {t(fieldsState.error ?? "We couldn't load fields for filtering.")}
            </p>
          ) : fieldsState.data.length === 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-stone-600">
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
                  <label className="text-xs uppercase tracking-[0.3em] text-stone-400">
                    {t("Field")}
                  </label>
                  <select
                    className="h-10 rounded-2xl border border-stone-200 bg-white/90 px-3 text-sm text-stone-700 shadow-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
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
                  <label className="text-xs uppercase tracking-[0.3em] text-stone-400">
                    {t("Value")}
                  </label>
                  {selectedField?.field_type === "select" ? (
                    <select
                      className="h-10 rounded-2xl border border-stone-200 bg-white/90 px-3 text-sm text-stone-700 shadow-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
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
                      className="h-10 rounded-2xl border border-stone-200 bg-white/90 px-3 text-sm text-stone-700 shadow-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
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
                      className="h-10 rounded-2xl border border-stone-200 bg-white/90 px-3 text-sm text-stone-700 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      placeholder={t("Enter value")}
                      value={filterValue}
                      onChange={(event) => setFilterValue(event.target.value)}
                      disabled={!selectedField}
                    />
                  )}
                </div>
                <Button
                  variant="secondary"
                  className="h-10"
                  onClick={handleAddFilter}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {t("Add filter")}
                </Button>
              </div>

              {filterError ? (
                <p className="text-sm text-rose-600">{t(filterError)}</p>
              ) : null}

              {filters.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <span
                      key={filter.id}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs text-stone-600"
                    >
                      <Tag className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-medium text-stone-700">
                        {filter.fieldName}
                      </span>
                      <span>=</span>
                      <span className="text-stone-500">{filter.value}</span>
                      <button
                        type="button"
                        className="text-stone-400 transition hover:text-stone-700"
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
                <p className="text-sm text-stone-500">
                  {t("No filters applied. Use the controls above to narrow the list.")}
                </p>
              )}
            </div>
          )}
        </div>

        {itemsState.status === "loading" ? (
          <div
            className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
            aria-busy="true"
          >
            {t("Loading items...")}
          </div>
        ) : itemsState.status === "error" ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
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
          <div className="rounded-3xl border border-stone-200 bg-white/80 p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  {t("No items yet")}
                </p>
                <h3 className="font-display mt-3 text-2xl text-stone-900">
                  {t("Start capturing your first item.")}
                </h3>
                <p className="mt-3 max-w-xl text-sm text-stone-600">
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Search className="h-8 w-8" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {itemsState.data.map((item) => {
                const metadataEntries = Object.entries(item.metadata ?? {});
                const imageCount = item.image_count ?? 0;
                const imageLabel = imageCount === 1 ? t("image") : t("images");
                const starCount = item.star_count ?? 0;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm",
                      item.is_highlight ? highlightCardClass : null
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                          {t("Item")}
                        </p>
                        <h3 className="mt-3 text-xl font-semibold text-stone-900">
                          {item.name}
                        </h3>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-xs text-stone-500">
                        <span>
                          {t("Added {date}", { date: formatDate(item.created_at) })}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500">
                          <Star className="h-3 w-3 text-amber-600" />
                          {starCount}
                        </span>
                        {imageCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500">
                            <ImageIcon className="h-3 w-3 text-amber-600" />
                            {imageCount} {imageLabel}
                          </span>
                        ) : null}
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
                          {t("No metadata captured yet.")}
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
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/collections/${collectionId}/items/${item.id}`}>
                          {t("View item")}
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
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
    </div>
  );
}

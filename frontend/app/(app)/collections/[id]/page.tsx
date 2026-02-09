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
  Tag,
  X
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  collectionApi,
  fieldApi,
  isApiError,
  itemApi,
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

const baseSortOptions = [
  { label: "Newest first", value: "-created_at" },
  { label: "Oldest first", value: "created_at" },
  { label: "Name A to Z", value: "name" },
  { label: "Name Z to A", value: "-name" }
];

const fieldTypeLabels: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  timestamp: "Timestamp",
  checkbox: "Checkbox",
  select: "Select"
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
};

const formatMetadataValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return value.toLocaleString("en-US");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return "Details";
  }
  return String(value);
};

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
};

const highlightCardClass =
  "border-amber-200/70 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_12px_32px_-22px_rgba(251,191,36,0.55)]";

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
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;

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
  const [sort, setSort] = React.useState(baseSortOptions[0].value);
  const [filters, setFilters] = React.useState<FilterEntry[]>([]);
  const [filterFieldId, setFilterFieldId] = React.useState("");
  const [filterValue, setFilterValue] = React.useState("");
  const [filterError, setFilterError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);
  const filterIdRef = React.useRef(0);

  const sortedFields = React.useMemo(
    () => sortFields(fieldsState.data),
    [fieldsState.data]
  );

  const sortOptions = React.useMemo(() => {
    const metadataOptions = sortedFields.flatMap((field) => [
      {
        label: `Metadata: ${field.name} (asc)`,
        value: `metadata:${field.name}`
      },
      {
        label: `Metadata: ${field.name} (desc)`,
        value: `-metadata:${field.name}`
      }
    ]);
    return [...baseSortOptions, ...metadataOptions];
  }, [sortedFields]);

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

  const filterParams = React.useMemo(
    () =>
      filters.map((filter) => `${filter.fieldName}=${filter.value}`),
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
    setRefreshKey((prev) => prev + 1);
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
              Back to collections
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              Collection overview
            </p>
            <h1 className="font-display mt-4 text-3xl text-stone-900">
              {collectionState.status === "ready" && collectionState.data
                ? collectionState.data.name
                : "Review collection items"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-stone-600">
              Search, filter, and organize the items in this collection.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/collections/${collectionId}/items/new`}>
              <Plus className="h-4 w-4" />
              Add item
            </Link>
          </Button>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      {collectionState.status === "loading" ? (
        <div
          className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
          aria-busy="true"
        >
          Loading collection details...
        </div>
      ) : collectionState.status === "error" ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
          <p className="text-sm font-medium text-rose-700">
            We hit a snag loading this collection.
          </p>
          <p className="mt-2 text-sm text-rose-600">
            {collectionState.error ?? "Please try again."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleRefresh}>
              Try again
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/collections">Back to collections</Link>
            </Button>
          </div>
        </div>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              Collection details
            </p>
            <h2 className="font-display mt-3 text-2xl text-stone-900">
              {collectionState.data?.name}
            </h2>
            <p className="mt-3 text-sm text-stone-600">
              {collectionState.data?.description ??
                "Add a description to capture the story behind this collection."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium ${
                  collectionState.data?.is_public
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {collectionState.data?.is_public ? "Public" : "Private"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-stone-600">
                {itemCount} items loaded
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-stone-600">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-600" />
                Created {formatDate(collectionState.data?.created_at)}
              </span>
              <span className="inline-flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-amber-600" />
                Updated {formatDate(collectionState.data?.updated_at)}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              Schema snapshot
            </p>
            {fieldsState.status === "loading" ? (
              <p className="mt-4 text-sm text-stone-500">
                Loading schema fields...
              </p>
            ) : fieldsState.status === "error" ? (
              <p className="mt-4 text-sm text-rose-600">
                {fieldsState.error ?? "We couldn't load schema fields."}
              </p>
            ) : fieldsState.data.length === 0 ? (
              <div className="mt-4 space-y-3 text-sm text-stone-600">
                <p>No schema fields yet.</p>
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/collections/${collectionId}/settings`}>
                    Define schema
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-stone-600">
                <p>{fieldsState.data.length} fields defined.</p>
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
                      +{sortedFields.length - 4} more fields
                    </p>
                  ) : null}
                </div>
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/collections/${collectionId}/settings`}>
                    Edit schema
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
              Items
            </p>
            <h2 className="font-display mt-3 text-2xl text-stone-900">
              Collection items
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                placeholder="Search items"
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
                Filters
              </p>
              <h3 className="mt-3 text-lg font-semibold text-stone-900">
                Refine by metadata
              </h3>
              <p className="mt-2 text-sm text-stone-600">
                Add filters using your schema field names and values.
              </p>
            </div>
            {filters.length > 0 ? (
              <Button size="sm" variant="ghost" onClick={handleClearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>

          {fieldsState.status === "loading" ? (
            <p className="mt-4 text-sm text-stone-500">
              Loading available fields...
            </p>
          ) : fieldsState.status === "error" ? (
            <p className="mt-4 text-sm text-rose-600">
              {fieldsState.error ??
                "We couldn't load fields for filtering."}
            </p>
          ) : fieldsState.data.length === 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-stone-600">
              <p>Define schema fields before filtering items.</p>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/collections/${collectionId}/settings`}>
                  Define schema
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[200px] flex-1 flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-stone-400">
                    Field
                  </label>
                  <select
                    className="h-10 rounded-2xl border border-stone-200 bg-white/90 px-3 text-sm text-stone-700 shadow-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    value={filterFieldId}
                    onChange={(event) => setFilterFieldId(event.target.value)}
                  >
                    <option value="">Select a field</option>
                    {sortedFields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex min-w-[200px] flex-1 flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-stone-400">
                    Value
                  </label>
                  {selectedField?.field_type === "select" ? (
                    <select
                      className="h-10 rounded-2xl border border-stone-200 bg-white/90 px-3 text-sm text-stone-700 shadow-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      value={filterValue}
                      onChange={(event) => setFilterValue(event.target.value)}
                      disabled={selectedFieldOptions.length === 0}
                    >
                      <option value="">Select a value</option>
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
                      <option value="true">True</option>
                      <option value="false">False</option>
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
                      placeholder="Enter value"
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
                  Add filter
                </Button>
              </div>

              {filterError ? (
                <p className="text-sm text-rose-600">{filterError}</p>
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
                        aria-label={`Remove filter ${filter.fieldName}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  No filters applied. Use the controls above to narrow the list.
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
            Loading items...
          </div>
        ) : itemsState.status === "error" ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
            <p className="text-sm font-medium text-rose-700">
              We hit a snag loading items.
            </p>
            <p className="mt-2 text-sm text-rose-600">
              {itemsState.error ?? "Please try again."}
            </p>
            <div className="mt-4">
              <Button variant="outline" onClick={handleRefresh}>
                Try again
              </Button>
            </div>
          </div>
        ) : itemsState.data.length === 0 ? (
          <div className="rounded-3xl border border-stone-200 bg-white/80 p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  No items yet
                </p>
                <h3 className="font-display mt-3 text-2xl text-stone-900">
                  Start capturing your first item.
                </h3>
                <p className="mt-3 max-w-xl text-sm text-stone-600">
                  Add an item to begin cataloguing metadata and imagery for this
                  collection.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href={`/collections/${collectionId}/items/new`}>
                      Add item
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={handleRefresh}>
                    Refresh items
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href={`/collections/${collectionId}/settings`}>
                      Review schema
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
                          Item
                        </p>
                        <h3 className="mt-3 text-xl font-semibold text-stone-900">
                          {item.name}
                        </h3>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-xs text-stone-500">
                        <span>Added {formatDate(item.created_at)}</span>
                        {imageCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500">
                            <ImageIcon className="h-3 w-3 text-amber-600" />
                            {imageCount} image{imageCount === 1 ? "" : "s"}
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
                          No metadata captured yet.
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
                              +{metadataEntries.length - 3} more fields
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/collections/${collectionId}/items/${item.id}`}>
                          View item
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col items-center gap-3">
              {loadMoreError ? (
                <p className="text-xs text-rose-600">{loadMoreError}</p>
              ) : null}
              {itemsState.hasMore ? (
                <Button
                  variant="outline"
                  disabled={isLoadingMore}
                  onClick={handleLoadMore}
                >
                  {isLoadingMore ? "Loading more..." : "Load more items"}
                </Button>
              ) : (
                <p className="text-xs text-stone-500">
                  You have reached the end of the list.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

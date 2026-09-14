"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Folder,
  RefreshCcw,
  Search,
  Star
} from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import { ItemPreviewCard } from "@/components/item-preview-card";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  imageApi,
  isApiError,
  starsApi
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";
import { Card, EmptyState } from "@/components/ui/card";

type StarsTab = "collections" | "items";

const highlightCardClass =
  "border-brand ring-2 ring-ring/70 shadow-[0_0_0_1px_hsl(var(--brand)/0.85),0_0_28px_2px_hsl(var(--brand)/0.25)]";

const formatDate = (value: string | null | undefined, locale: string) => {
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
};

export default function StarsPage() {
  const { t, tc, locale } = useI18n();
  const [query, setQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<StarsTab>("collections");
  const term = useDebouncedValue(query).trim();

  const collectionsQuery = useQuery({
    queryKey: [...queryKeys.stars.collections(), term],
    queryFn: ({ signal }) =>
      starsApi.listCollections({ q: term || undefined, limit: 100, signal })
  });
  const itemsQuery = useQuery({
    queryKey: [...queryKeys.stars.items(), term],
    queryFn: ({ signal }) =>
      starsApi.listItems({ q: term || undefined, limit: 100, signal })
  });

  const failure = collectionsQuery.error ?? itemsQuery.error;
  const state = {
    status: (failure
      ? "error"
      : collectionsQuery.isPending || itemsQuery.isPending
        ? "loading"
        : "ready") as "loading" | "ready" | "error",
    collections: collectionsQuery.data ?? [],
    items: itemsQuery.data ?? [],
    error: failure
      ? isApiError(failure)
        ? failure.detail
        : "We couldn't load your stars."
      : undefined
  };

  const refresh = React.useCallback(() => {
    void collectionsQuery.refetch();
    void itemsQuery.refetch();
  }, [collectionsQuery, itemsQuery]);

  const totalStarredEntries = state.collections.length + state.items.length;
  const activeTabCount =
    activeTab === "collections" ? state.collections.length : state.items.length;

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Eyebrow tone="brand" spacing="wide">
              {t("Stars")}
            </Eyebrow>
            <SectionHeading as="h1" size="xl" className="mt-3">
              {t("Your starred archive.")}
            </SectionHeading>
            <p className="mt-2 text-sm text-muted-strong">
              {t(
                "Review everything you have starred across collections and items."
              )}
            </p>
          </div>
          <Button variant="outline" onClick={refresh}>
            <RefreshCcw className="h-4 w-4" />
            {t("Refresh")}
          </Button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:max-w-xl sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
            <input
              type="search"
              placeholder={t("Search your starred items and collections")}
              className="h-11 w-full rounded-full border border-border bg-card pl-9 pr-3 text-sm text-muted-strong shadow-sm transition focus:border-brand-border focus:outline-none focus:ring-2 focus:ring-ring"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {tc(totalStarredEntries, "{count} star", "{count} stars")}
          </span>
        </div>
      </header>

      {state.status === "loading" && totalStarredEntries === 0 ? (
        <EmptyState
          aria-busy="true">
          {t("Loading your stars...")}
        </EmptyState>
      ) : state.status === "error" && totalStarredEntries === 0 ? (
        <Alert className="rounded-3xl p-6">
          {t(state.error ?? "We couldn't load your stars.")}
        </Alert>
      ) : totalStarredEntries === 0 ? (
        <Card tone="subtle" padding="lg">
          <p className="text-sm font-medium text-muted-strong">{t("No stars yet.")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Star public collections or items to save them here.")}
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="/explore">{t("Explore public collections")}</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm"
              role="tablist"
              aria-label={t("Starred items and collections")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "collections"}
                onClick={() => setActiveTab("collections")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === "collections"
                    ? "bg-panel text-white shadow-sm"
                    : "text-muted-strong hover:text-foreground"
                }`}
              >
                {t("Collections")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "items"}
                onClick={() => setActiveTab("items")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === "items"
                    ? "bg-panel text-white shadow-sm"
                    : "text-muted-strong hover:text-foreground"
                }`}
              >
                {t("Items")}
              </button>
            </div>
            <span className="text-xs text-muted-foreground">
              {t("{count} total", { count: activeTabCount })}
            </span>
          </div>

          {activeTab === "collections" ? (
            state.collections.length === 0 ? (
              <EmptyState>
                {t("No starred collections match this search.")}
              </EmptyState>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {state.collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Folder className="h-3.5 w-3.5 text-brand" />
                        {collection.is_public ? t("Public") : t("Private")}
                      </span>
                      <span>
                        {t("Starred {date}", {
                          date: formatDate(collection.starred_at, locale)
                        })}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-foreground">
                      {collection.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-strong">
                      {collection.description ?? t("No description provided.")}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-brand" />
                          {t("Created {date}", {
                            date: formatDate(collection.created_at, locale)
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-brand" />
                          {collection.star_count}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Folder className="h-3.5 w-3.5 text-brand" />
                          {collection.item_count}
                        </span>
                      </div>
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={collection.target_path}>{t("Open")}</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : state.items.length === 0 ? (
            <EmptyState>
              {t("No starred items match this search.")}
            </EmptyState>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {state.items.map((item) => {
                const imageCount = item.image_count ?? 0;
                const imageLabel =
                  tc(imageCount, "{count} image", "{count} images");
                return (
                  <ItemPreviewCard
                    key={`${item.collection_id}-${item.id}`}
                    href={item.target_path}
                    title={item.name}
                    eyebrow={item.collection_name}
                    createdLabel={t("Starred {date}", {
                      date: formatDate(item.starred_at, locale)
                    })}
                    description={item.notes}
                    descriptionFallback={t("No description provided.")}
                    metadata={[
                      {
                        label: t("Created"),
                        value: formatDate(item.created_at, locale)
                      }
                    ]}
                    metadataFallback={t("Open item details for full metadata.")}
                    imageSrc={
                      item.primary_image_id
                        ? imageApi.url(item.primary_image_id, "medium")
                        : null
                    }
                    imageAlt={item.name}
                    imageFallbackLabel={t("No image")}
                    starCount={item.star_count}
                    imageCount={imageCount}
                    imageCountLabel={imageLabel}
                    isHighlighted={item.is_highlight}
                    highlightClassName={highlightCardClass}
                    openLabel={t("Open")}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

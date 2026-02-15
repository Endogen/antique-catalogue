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

import { ItemPreviewCard } from "@/components/item-preview-card";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  imageApi,
  isApiError,
  starsApi,
  type StarredCollectionResponse,
  type StarredItemResponse
} from "@/lib/api";

type LoadState = {
  status: "loading" | "ready" | "error";
  collections: StarredCollectionResponse[];
  items: StarredItemResponse[];
  error?: string;
};

type StarsTab = "collections" | "items";

const highlightCardClass =
  "border-amber-400 ring-2 ring-amber-300/70 shadow-[0_0_0_1px_rgba(251,191,36,0.85),0_0_28px_2px_rgba(217,119,6,0.25)]";

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
  const { t, locale } = useI18n();
  const [query, setQuery] = React.useState("");
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<StarsTab>("collections");
  const [state, setState] = React.useState<LoadState>({
    status: "loading",
    collections: [],
    items: []
  });

  React.useEffect(() => {
    let isActive = true;
    const handle = setTimeout(() => {
      void (async () => {
        setState((prev) => ({
          ...prev,
          status: "loading",
          error: undefined
        }));
        try {
          const term = query.trim();
          const [collections, items] = await Promise.all([
            starsApi.listCollections({
              q: term || undefined,
              limit: 100
            }),
            starsApi.listItems({
              q: term || undefined,
              limit: 100
            })
          ]);
          if (!isActive) {
            return;
          }
          setState({
            status: "ready",
            collections,
            items
          });
        } catch (error) {
          if (!isActive) {
            return;
          }
          setState((prev) => ({
            status: "error",
            collections: prev.collections,
            items: prev.items,
            error: isApiError(error)
              ? error.detail
              : "We couldn't load your stars."
          }));
        }
      })();
    }, 250);

    return () => {
      isActive = false;
      clearTimeout(handle);
    };
  }, [query, refreshToken]);

  const totalStarredEntries = state.collections.length + state.items.length;
  const activeTabCount =
    activeTab === "collections" ? state.collections.length : state.items.length;

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              {t("Stars")}
            </p>
            <h1 className="font-display mt-3 text-3xl text-stone-900">
              {t("Your starred archive.")}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {t(
                "Review everything you have starred across collections and items."
              )}
            </p>
          </div>
          <Button variant="outline" onClick={() => setRefreshToken((prev) => prev + 1)}>
            <RefreshCcw className="h-4 w-4" />
            {t("Refresh")}
          </Button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:max-w-xl sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              placeholder={t("Search your starred items and collections")}
              className="h-11 w-full rounded-full border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-700 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <span className="text-xs text-stone-500">
            {t("{count} stars", { count: totalStarredEntries })}
          </span>
        </div>
      </header>

      {state.status === "loading" && totalStarredEntries === 0 ? (
        <div
          className="rounded-3xl border border-dashed border-stone-200 bg-white/70 p-8 text-sm text-stone-500"
          aria-busy="true"
        >
          {t("Loading your stars...")}
        </div>
      ) : state.status === "error" && totalStarredEntries === 0 ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-6 text-sm text-rose-700">
          {t(state.error ?? "We couldn't load your stars.")}
        </div>
      ) : totalStarredEntries === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-white/80 p-8">
          <p className="text-sm font-medium text-stone-700">{t("No stars yet.")}</p>
          <p className="mt-2 text-sm text-stone-500">
            {t("Star public collections or items to save them here.")}
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="/explore">{t("Explore public collections")}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex rounded-full border border-stone-200 bg-white p-1 shadow-sm"
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
                    ? "bg-stone-900 text-white shadow-sm"
                    : "text-stone-600 hover:text-stone-900"
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
                    ? "bg-stone-900 text-white shadow-sm"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {t("Items")}
              </button>
            </div>
            <span className="text-xs text-stone-500">
              {t("{count} total", { count: activeTabCount })}
            </span>
          </div>

          {activeTab === "collections" ? (
            state.collections.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("No starred collections match this search.")}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {state.collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <Folder className="h-3.5 w-3.5 text-amber-600" />
                        {collection.is_public ? t("Public") : t("Private")}
                      </span>
                      <span>
                        {t("Starred {date}", {
                          date: formatDate(collection.starred_at, locale)
                        })}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-stone-900">
                      {collection.name}
                    </h3>
                    <p className="mt-1 text-xs text-stone-600">
                      {collection.description ?? t("No description provided.")}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-amber-600" />
                          {t("Created {date}", {
                            date: formatDate(collection.created_at, locale)
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-600" />
                          {collection.star_count}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Folder className="h-3.5 w-3.5 text-amber-600" />
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
            <div className="rounded-3xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
              {t("No starred items match this search.")}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {state.items.map((item) => {
                const imageCount = item.image_count ?? 0;
                const imageLabel =
                  imageCount === 1
                    ? t("{count} image", { count: imageCount })
                    : t("{count} images", { count: imageCount });
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

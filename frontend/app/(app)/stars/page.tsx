"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Folder,
  RefreshCcw,
  Search,
  Sparkles,
  Star
} from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  imageApi,
  isApiError,
  starsApi,
  type StarredCollectionResponse,
  type StarredItemResponse
} from "@/lib/api";
import { cn } from "@/lib/utils";

type LoadState = {
  status: "loading" | "ready" | "error";
  collections: StarredCollectionResponse[];
  items: StarredItemResponse[];
  error?: string;
};

const highlightCardClass =
  "border-amber-200/70 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_12px_32px_-22px_rgba(251,191,36,0.55)]";

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

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
};

export default function StarsPage() {
  const { t, locale } = useI18n();
  const [query, setQuery] = React.useState("");
  const [refreshToken, setRefreshToken] = React.useState(0);
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

  const totalStars = state.collections.length + state.items.length;

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
            {t("{count} total", { count: totalStars })}
          </span>
        </div>
      </header>

      {state.status === "loading" && totalStars === 0 ? (
        <div
          className="rounded-3xl border border-dashed border-stone-200 bg-white/70 p-8 text-sm text-stone-500"
          aria-busy="true"
        >
          {t("Loading your stars...")}
        </div>
      ) : state.status === "error" && totalStars === 0 ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-6 text-sm text-rose-700">
          {t(state.error ?? "We couldn't load your stars.")}
        </div>
      ) : totalStars === 0 ? (
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
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-stone-900">
                {t("Collections")}
              </h2>
              <span className="text-xs text-stone-500">
                {t("{count} total", { count: state.collections.length })}
              </span>
            </div>

            {state.collections.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("No starred collections match this search.")}
              </div>
            ) : (
              <div className="space-y-3">
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
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-stone-900">{t("Items")}</h2>
              <span className="text-xs text-stone-500">
                {t("{count} total", { count: state.items.length })}
              </span>
            </div>

            {state.items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("No starred items match this search.")}
              </div>
            ) : (
              <div className="space-y-3">
                {state.items.map((item) => (
                  <div
                    key={`${item.collection_id}-${item.id}`}
                    className={cn(
                      "rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm",
                      item.is_highlight ? highlightCardClass : null
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                          {item.collection_name}
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-stone-900">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-xs text-stone-500">
                          {t("Starred {date}", {
                            date: formatDate(item.starred_at, locale)
                          })}
                        </p>
                      </div>
                      {item.primary_image_id ? (
                        <div className="h-14 w-14 overflow-hidden rounded-xl border border-stone-100 bg-stone-50">
                          <img
                            src={imageApi.url(item.primary_image_id, "thumb")}
                            alt={item.name}
                            className="block h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-stone-100 bg-stone-50 text-stone-400">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    {item.notes ? (
                      <p className="mt-3 text-sm text-stone-600">
                        {truncate(item.notes, 130)}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-600" />
                          {item.star_count}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-amber-600" />
                          {t("Created {date}", {
                            date: formatDate(item.created_at, locale)
                          })}
                        </span>
                      </div>
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={item.target_path}>{t("Open")}</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderOpen, RefreshCcw, Search } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  imageApi,
  isApiError,
  searchApi,
  type ItemSearchResponse
} from "@/lib/api";
import { cn } from "@/lib/utils";

type LoadState = {
  status: "idle" | "loading" | "ready" | "error";
  data: ItemSearchResponse[];
  error?: string;
};

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

const highlightCardClass =
  "border-amber-400 ring-2 ring-amber-300/70 shadow-[0_0_0_1px_rgba(251,191,36,0.85),0_18px_36px_-20px_rgba(217,119,6,0.75)]";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const queryParam = searchParams.get("query") ?? "";
  const [searchValue, setSearchValue] = React.useState(queryParam);
  const [state, setState] = React.useState<LoadState>({
    status: "idle",
    data: []
  });

  const runSearch = React.useCallback(async (term: string) => {
    setState({ status: "loading", data: [] });
    try {
      const data = await searchApi.items(term);
      setState({ status: "ready", data });
    } catch (error) {
      setState({
        status: "error",
        data: [],
        error: isApiError(error)
          ? error.detail
          : "We couldn't load search results."
      });
    }
  }, []);

  React.useEffect(() => {
    setSearchValue(queryParam);
    const term = queryParam.trim();
    if (!term) {
      setState({ status: "idle", data: [] });
      return;
    }
    void runSearch(term);
  }, [queryParam, runSearch]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = searchValue.trim();
    if (!term) {
      setState({ status: "idle", data: [] });
      return;
    }
    router.push(`/search?query=${encodeURIComponent(term)}`);
  };

  const handleRefresh = () => {
    const term = queryParam.trim();
    if (!term) {
      return;
    }
    void runSearch(term);
  };

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              {t("Search")}
            </p>
            <h1 className="font-display mt-3 text-3xl text-stone-900">
              {t("Search your items.")}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {t("Find items across every collection by name or notes.")}
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCcw className="h-4 w-4" />
            {t("Refresh")}
          </Button>
        </div>
        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={handleSubmit}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              placeholder={t("Search items by name or notes")}
              className="h-11 w-full rounded-full border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-700 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>
          <Button type="submit" className="sm:w-auto">
            {t("Search")}
          </Button>
        </form>
      </header>

      {state.status === "idle" ? (
        <div className="rounded-3xl border border-dashed border-stone-200 bg-white/70 p-8 text-sm text-stone-500">
          {t("Enter a search term to see matching items.")}
        </div>
      ) : state.status === "loading" ? (
        <div
          className="rounded-3xl border border-dashed border-stone-200 bg-white/70 p-8 text-sm text-stone-500"
          aria-busy="true"
        >
          {t("Searching items...")}
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-6 text-sm text-rose-700">
          {t(state.error ?? "We couldn't load search results.")}
        </div>
      ) : state.data.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-white/70 p-8">
          <p className="text-sm font-medium text-stone-700">
            {t("No items matched your search.")}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            {t("Try another term or check spelling.")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              {t("Results")}
            </p>
            <span className="text-xs text-stone-400">
              {t("{count} items found", { count: state.data.length })}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {state.data.map((item) => {
              const imageId = item.primary_image_id ?? null;
              return (
                <div
                  key={`${item.collection_id}-${item.id}`}
                  className={cn(
                    "rounded-3xl border border-stone-200 bg-white/80 p-5 shadow-sm",
                    item.is_highlight ? highlightCardClass : null
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                        {item.collection_name}
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-stone-900">
                        {item.name}
                      </h2>
                      <p className="mt-2 text-xs text-stone-500">
                        {t("Added {date}", { date: formatDate(item.created_at, locale) })}
                      </p>
                    </div>
                    {imageId ? (
                      <div className="h-16 w-16 overflow-hidden rounded-2xl border border-stone-100 bg-stone-50">
                        <img
                          src={imageApi.url(imageId, "thumb")}
                          alt={item.name}
                          className="block h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-stone-100 bg-stone-50 text-stone-400">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  {item.notes ? (
                    <p className="mt-3 text-sm text-stone-600">
                      {truncate(item.notes, 140)}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" asChild>
                      <Link
                        href={`/collections/${item.collection_id}/items/${item.id}`}
                      >
                        {t("Open item")}
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/collections/${item.collection_id}`}>
                        {t("View collection")}
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchFallback() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-stone-500">
      {t("Loading...")}
    </div>
  );
}

export default function SearchPage() {
  return (
    <React.Suspense fallback={<SearchFallback />}>
      <SearchContent />
    </React.Suspense>
  );
}

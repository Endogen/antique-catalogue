"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RefreshCcw, Search } from "lucide-react";

import { ItemPreviewCard } from "@/components/item-preview-card";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { imageApi, searchApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";

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

const highlightCardClass =
  "border-brand ring-2 ring-brand/40 shadow-[0_0_0_1px_hsl(var(--brand)/0.85),0_0_28px_2px_hsl(var(--brand)/0.25)]";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, tc, locale } = useI18n();
  const queryParam = searchParams.get("query") ?? "";
  const term = queryParam.trim();
  const [searchValue, setSearchValue] = React.useState(queryParam);

  React.useEffect(() => {
    setSearchValue(queryParam);
  }, [queryParam]);

  // react-query keys the request by search term, so a slower response for an
  // earlier term can never overwrite the results for the current one.
  const query = useQuery({
    queryKey: queryKeys.search.items(term),
    queryFn: ({ signal }) => searchApi.items(term, { limit: 100, signal }),
    enabled: term.length > 0
  });

  const state = toLoadState(query, "We couldn't load search results.", []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = searchValue.trim();
    if (!next) {
      router.push("/search");
      return;
    }
    router.push(`/search?query=${encodeURIComponent(next)}`);
  };

  const handleRefresh = () => {
    if (term) {
      void query.refetch();
    }
  };

  return (
    <div className="space-y-8">
      <Card tone="subtle">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Eyebrow tone="brand" spacing="wide">
              {t("Search")}
            </Eyebrow>
            <SectionHeading as="h1" size="xl" className="mt-3">
              {t("Search your items.")}
            </SectionHeading>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("Find items across every collection by name or notes.")}
            </p>
          </div>
          <Button
            variant="outline"
            className="w-10 px-0"
            onClick={handleRefresh}
            aria-label={t("Refresh")}
            title={t("Refresh")}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={handleSubmit}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder={t("Search items by name or notes")}
              className="h-11 w-full rounded-full border border-input bg-card pl-9 pr-3 text-sm text-foreground shadow-xs transition focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>
          <Button type="submit" className="sm:w-auto">
            {t("Search")}
          </Button>
        </form>
      </Card>

      {state.status === "idle" ? (
        <EmptyState>{t("Enter a search term to see matching items.")}</EmptyState>
      ) : state.status === "loading" ? (
        <EmptyState aria-busy="true">{t("Searching items...")}</EmptyState>
      ) : state.status === "error" ? (
        <Alert className="rounded-3xl p-6">
          {t(state.error ?? "We couldn't load search results.")}
        </Alert>
      ) : state.data.length === 0 ? (
        <Card tone="subtle" padding="lg">
          <p className="text-sm font-medium text-foreground">
            {t("No items matched your search.")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Try another term or check spelling.")}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Eyebrow>{t("Results")}</Eyebrow>
            <span className="text-xs text-muted-foreground">
              {tc(state.data.length, "{count} item found", "{count} items found")}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {state.data.map((item) => {
              const imageId = item.primary_image_id ?? null;
              const imageCount = item.image_count ?? 0;
              const imageLabel =
                tc(imageCount, "{count} image", "{count} images");
              return (
                <ItemPreviewCard
                  key={`${item.collection_id}-${item.id}`}
                  href={`/collections/${item.collection_id}/items/${item.id}`}
                  title={item.name}
                  eyebrow={item.collection_name}
                  createdLabel={t("Added {date}", {
                    date: formatDate(item.created_at, locale)
                  })}
                  description={item.notes}
                  descriptionFallback={t("No description provided.")}
                  metadataFallback={t("Open item details for full metadata.")}
                  imageSrc={imageId ? imageApi.url(imageId, "medium") : null}
                  imageAlt={item.name}
                  imageFallbackLabel={t("No image")}
                  imageCount={imageCount}
                  imageCountLabel={imageLabel}
                  isHighlighted={item.is_highlight}
                  highlightClassName={highlightCardClass}
                  openLabel={t("Open")}
                />
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
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
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

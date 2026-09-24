"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  Globe2,
  RefreshCcw,
  Search,
  Star
} from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { PublicHeader } from "@/components/public-header";
import { publicCollectionApi, type CollectionResponse } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";
import { Card, EmptyState } from "@/components/ui/card";

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

const filterCollections = (
  collections: CollectionResponse[],
  query: string
) => {
  if (!query) {
    return collections;
  }
  const normalized = query.toLowerCase();
  return collections.filter((collection) => {
    const description = collection.description ?? "";
    const ownerUsername = collection.owner_username ?? "";
    return (
      collection.name.toLowerCase().includes(normalized) ||
      description.toLowerCase().includes(normalized) ||
      ownerUsername.toLowerCase().includes(normalized)
    );
  });
};

export default function ExplorePage() {
  const { isAuthenticated, status: authStatus } = useAuth();
  const { t, tc, locale } = useI18n();
  const [search, setSearch] = React.useState("");

  const query = useQuery({
    queryKey: queryKeys.explore.list(""),
    queryFn: ({ signal }) => publicCollectionApi.list({ signal })
  });
  const state = toLoadState<CollectionResponse[]>(
    query,
    "We couldn't load public collections.",
    []
  );
  const { refetch } = query;
  const loadCollections = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  const filtered = React.useMemo(
    () => filterCollections(state.data, search.trim()),
    [state.data, search]
  );

  const totalCount = state.data.length;
  const showAuthenticatedCtas =
    authStatus === "authenticated" && isAuthenticated;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-amber-300/20 blur-[100px]" />
      <div className="pointer-events-none absolute top-[35%] left-[-8%] h-72 w-72 rounded-full bg-amber-200/25 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-8%] h-80 w-80 rounded-full bg-panel/10 blur-[160px]" />
      <div className="relative z-10">
        <PublicHeader />

        <section>
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-12 pt-6 lg:flex-row lg:items-center lg:px-12 lg:pt-12">
            <div className="flex-1">
              <Eyebrow tone="brand" spacing="wide">
                {t("Public directory")}
              </Eyebrow>
              <h1 className="font-display mt-4 text-4xl text-foreground sm:text-5xl">
                {t("Explore shared collections and curated archives.")}
              </h1>
              <p className="mt-4 max-w-xl text-sm text-muted-strong sm:text-base">
                {t(
                  "Browse public catalogues to discover provenance notes, condition details, and restoration history from collectors worldwide."
                )}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href="/register">{t("Start your own archive")}</Link>
                </Button>
                {showAuthenticatedCtas ? (
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/dashboard">{t("Go to dashboard")}</Link>
                  </Button>
                ) : null}
              </div>
              <div className="mt-8 rounded-2xl border border-border bg-card/90 p-4 shadow-xs">
                <label htmlFor="collection-search" className="text-xs uppercase tracking-eyebrow text-muted-foreground">
                  {t("Search collections")}
                </label>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-xs focus-within:border-brand-border focus-within:ring-2 focus-within:ring-ring">
                  <Search className="h-4 w-4 text-muted-subtle" />
                  <input
                    id="collection-search"
                    type="search"
                    className="min-w-0 w-full appearance-none bg-transparent text-sm text-muted-strong focus:outline-hidden"
                    placeholder={t("Search by collection name or description")}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("Showing {shown} of {total} public collections.", {
                    shown: filtered.length,
                    total: totalCount
                  })}
                </p>
              </div>
            </div>
            <div className="flex-1">
              <Card className="shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)]">
                <div className="flex items-center justify-between">
                  <Eyebrow tone="subtle">
                    {t("Directory snapshot")}
                  </Eyebrow>
                  <span className="rounded-full bg-success-muted px-3 py-1 text-xs font-medium text-success">
                    {t("Live")}
                  </span>
                </div>
                <SectionHeading className="mt-4">
                  {t("Public collections")}
                </SectionHeading>
                <p className="mt-3 text-sm text-muted-strong">
                  {t(
                    "Discover what others are cataloguing and share your own collection when you are ready."
                  )}
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <Eyebrow tone="subtle">
                      {t("Total")}
                    </Eyebrow>
                    <p className="mt-3 text-2xl font-semibold text-foreground">
                      {state.status === "ready" ? totalCount : "-"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("Shared archives")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <Eyebrow tone="subtle">
                      {t("Access")}
                    </Eyebrow>
                    <p className="mt-3 text-2xl font-semibold text-foreground">
                      {t("Free")}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("Read-only browsing")}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-panel px-4 py-4 text-panel-foreground sm:flex-row sm:items-center sm:justify-between sm:py-3">
                  <div className="min-w-0">
                    <Eyebrow tone="panel" spacing="tight">
                      {t("Publish your work")}
                    </Eyebrow>
                    <p className="mt-1 text-sm font-medium">
                      {t("Share curated catalogues publicly.")}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" className="shrink-0 self-start sm:self-auto" asChild>
                    <Link href="/collections/new">{t("Create collection")}</Link>
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Eyebrow>
                {t("Public collections")}
              </Eyebrow>
              <SectionHeading className="mt-3">
                {t("Browse the directory.")}
              </SectionHeading>
            </div>
            <Button
              variant="outline"
              className="w-10 px-0"
              onClick={() => loadCollections()}
              aria-label={t("Refresh")}
              title={t("Refresh")}
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>

          {state.status === "loading" ? (
            <EmptyState
              className="mt-6"
              aria-busy="true">
              {t("Loading public collections...")}
            </EmptyState>
          ) : state.status === "error" ? (
            <Alert className="rounded-3xl p-6 mt-6">
              <p className="text-sm font-medium text-destructive">
                {t("We hit a snag loading the directory.")}
              </p>
              <p className="mt-2 text-sm text-destructive">
                {t(state.error ?? "Please try again.")}
              </p>
              <div className="mt-4">
                <Button variant="outline" onClick={() => loadCollections()}>
                  {t("Try again")}
                </Button>
              </div>
            </Alert>
          ) : filtered.length === 0 ? (
            <Card tone="subtle" padding="lg" className="mt-6">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <Eyebrow>
                    {t("No matches")}
                  </Eyebrow>
                  <SectionHeading as="h3" className="mt-3">
                    {t("We could not find collections for that search.")}
                  </SectionHeading>
                  <p className="mt-3 max-w-xl text-sm text-muted-strong">
                    {t(
                      "Try adjusting your search terms or refresh to see the latest public catalogues."
                    )}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => setSearch("")}>
                      {t("Clear search")}
                    </Button>
                    <Button asChild>
                      <Link href="/register">{t("Create your own")}</Link>
                    </Button>
                  </div>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                  <Globe2 className="h-8 w-8" />
                </div>
              </div>
            </Card>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filtered.map((collection) => (
                <Card
                  key={collection.id}
                  className="transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-success-border bg-success-muted px-3 py-1 text-xs font-medium text-success">
                      <Globe2 className="h-3.5 w-3.5" />
                      {t("Public")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("Updated {date}", {
                        date: formatDate(collection.updated_at, locale)
                      })}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-foreground">
                    {collection.name}
                  </h3>
                  {collection.owner_username ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("By")}{" "}
                      <Link
                        href={`/profile/${encodeURIComponent(collection.owner_username)}`}
                        className="font-medium text-brand hover:text-brand-strong"
                      >
                        @{collection.owner_username}
                      </Link>
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-strong">
                    {collection.description ??
                      t("This collection is ready to be explored.")}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-brand" />
                        {t("Created {date}", {
                          date: formatDate(collection.created_at, locale)
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Boxes className="h-4 w-4 text-brand" />
                        {tc(collection.item_count ?? 0, "{count} item", "{count} items")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-4 w-4 text-brand" />
                        {tc(collection.star_count ?? 0, "{count} star", "{count} stars")}
                      </span>
                    </div>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/explore/${collection.id}`}>
                        {t("View collection")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

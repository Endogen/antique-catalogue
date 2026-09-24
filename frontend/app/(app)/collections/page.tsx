"use client";

import { CollectionArchive } from "@/components/collection-archive";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Folder,
  Globe2,
  Lock,
  Plus,
  RefreshCcw,
  Star,
  Sparkles
} from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { collectionApi, type CollectionResponse } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { Card, EmptyState } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) {
    return "—";
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

export default function CollectionsPage() {
  const { t, tc, locale } = useI18n();
  const query = useQuery({
    queryKey: queryKeys.collections.list(),
    queryFn: ({ signal }) => collectionApi.list({ signal })
  });

  const state = toLoadState<CollectionResponse[]>(
    query,
    "We couldn't load your collections.",
    []
  );
  const { refetch } = query;
  const loadCollections = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  const totalCount = state.data.length;
  const publicCount = state.data.filter((collection) => collection.is_public)
    .length;
  const privateCount = totalCount - publicCount;
  const totalItems = state.data.reduce(
    (sum, collection) => sum + (collection.item_count ?? 0),
    0
  );

  const getVisibilityMeta = (collection: CollectionResponse) => {
    if (collection.is_public) {
      return {
        label: t("Public"),
        Icon: Globe2,
        className: "border-success-border bg-success-muted text-success"
      };
    }
    return {
      label: t("Private"),
      Icon: Lock,
      className: "border-brand-border bg-brand-muted text-brand"
    };
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Eyebrow tone="brand" spacing="wide">
            {t("Collections")}
          </Eyebrow>
          <SectionHeading as="h1" size="xl" className="mt-4">
            {t("Curate and organize your archive.")}
          </SectionHeading>
          <p className="mt-3 max-w-2xl text-sm text-muted-strong">
            {t(
              "Build collections for every category of antique, then capture metadata, imagery, and provenance in one focused workspace."
            )}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:gap-3">
          <Button className="grow px-3 sm:grow-0 sm:px-4" asChild>
            <Link href="/collections/new">
              <Plus className="h-4 w-4" />
              {t("Create collection")}
            </Link>
          </Button>
          <CollectionArchive className="grow px-3 sm:grow-0 sm:px-4" />
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
      </header>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-xs sm:p-5">
          <Eyebrow tone="subtle">
            {t("Total items")}
          </Eyebrow>
          <p className="mt-3 text-3xl font-semibold text-foreground sm:mt-4">
            {totalItems}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Catalogued across your collections.")}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-xs sm:p-5">
          <Eyebrow tone="subtle">
            {t("Total collections")}
          </Eyebrow>
          <p className="mt-3 text-3xl font-semibold text-foreground sm:mt-4">
            {totalCount}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("All archives in your studio.")}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-xs sm:p-5">
          <Eyebrow tone="subtle">
            {t("Public collections")}
          </Eyebrow>
          <p className="mt-3 text-3xl font-semibold text-foreground sm:mt-4">
            {publicCount}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Visible in the public directory.")}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-xs sm:p-5">
          <Eyebrow tone="subtle">
            {t("Private collections")}
          </Eyebrow>
          <p className="mt-3 text-3xl font-semibold text-foreground sm:mt-4">
            {privateCount}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Internal research and drafts.")}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Eyebrow>
              {t("Your archive")}
            </Eyebrow>
            <SectionHeading className="mt-3">
              {t("Active collections")}
            </SectionHeading>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/explore">
              <Sparkles className="h-4 w-4" />
              {t("Explore public collections")}
            </Link>
          </Button>
        </div>

        {state.status === "loading" ? (
          <EmptyState
            aria-busy="true">
            {t("Loading your collections...")}
          </EmptyState>
        ) : state.status === "error" ? (
          <Alert className="rounded-3xl p-6">
            <p className="text-sm font-medium text-destructive">
              {t("We hit a snag loading collections.")}
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
        ) : state.data.length === 0 ? (
          <Card tone="subtle" padding="lg">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <Eyebrow>
                  {t("No collections yet")}
                </Eyebrow>
                <SectionHeading as="h3" className="mt-3">
                  {t("Start by defining your first collection.")}
                </SectionHeading>
                <p className="mt-3 max-w-xl text-sm text-muted-strong">
                  {t(
                    "Create a collection to set up metadata fields, then begin documenting items and images from any device."
                  )}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/collections/new">
                      <Plus className="h-4 w-4" />
                      {t("Create collection")}
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/explore">
                      {t("Browse public catalogues")}
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                <Folder className="h-8 w-8" />
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {state.data.map((collection) => {
              const meta = getVisibilityMeta(collection);
              const itemCount = collection.item_count ?? 0;
              const itemLabel = itemCount === 1 ? t("item") : t("items");
              return (
                <Card
                  key={collection.id}
                  className="transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${meta.className}`}
                    >
                      <meta.Icon className="h-3.5 w-3.5" />
                      {meta.label}
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
                  <p className="mt-2 text-sm text-muted-strong">
                    {collection.description ??
                      t(
                        "Add a description to capture the story behind this collection."
                      )}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-brand" />
                        {t("Created {date}", {
                          date: formatDate(collection.created_at, locale)
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-brand" />
                        {itemCount} {itemLabel}
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-brand" />
                        {tc(collection.star_count ?? 0, "{count} star", "{count} stars")}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/collections/${collection.id}`}>
                          {t("View collection")}
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/collections/${collection.id}/settings`}>
                          {t("Collection settings")}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

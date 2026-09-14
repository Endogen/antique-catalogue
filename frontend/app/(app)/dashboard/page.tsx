"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Folder, Star } from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { activityActionLabel, describeActivity } from "@/lib/activity";
import {
  activityApi,
  collectionApi,
  type ActivityLogResponse,
  type CollectionResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { Card, EmptyState } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

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

const formatDateTime = (value: string | null | undefined, locale: string) => {
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
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
};

export default function DashboardPage() {
  const { t, tc, locale } = useI18n();
  const collectionsQuery = useQuery({
    queryKey: queryKeys.collections.list(),
    queryFn: ({ signal }) => collectionApi.list({ signal })
  });
  const activityQuery = useQuery({
    queryKey: queryKeys.activity.list(5),
    queryFn: ({ signal }) => activityApi.list({ limit: 5, signal })
  });

  const collectionsState = toLoadState<CollectionResponse[]>(
    collectionsQuery,
    "We couldn't load your collections.",
    []
  );
  const activityState = toLoadState<ActivityLogResponse[]>(
    activityQuery,
    "Activity unavailable right now.",
    []
  );

  const { refetch: refetchCollections } = collectionsQuery;
  const { refetch: refetchActivity } = activityQuery;
  const loadCollections = React.useCallback(() => {
    void refetchCollections();
  }, [refetchCollections]);
  const loadActivity = React.useCallback(() => {
    void refetchActivity();
  }, [refetchActivity]);

  const totalCount = collectionsState.data.length;
  const hasCollections = collectionsState.status === "ready" && totalCount > 0;
  const recentCollections = React.useMemo(() => {
    return [...collectionsState.data]
      .sort((a, b) => {
        const aDate = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
        const bDate = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 2);
  }, [collectionsState.data]);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
        <Card tone="subtle">
          <Eyebrow>
            {t("Your collections")}
          </Eyebrow>
          <SectionHeading className="mt-3">
            {hasCollections
              ? t("Continue your catalogue.")
              : t("Start shaping your first collection.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-strong">
            {hasCollections
              ? t(
                  "Jump back into a collection to refine metadata, add items, and keep your archive up to date."
                )
              : t(
                  "Define the fields that matter most for your collection. Once you are ready, share access with collaborators and start capturing items."
                )}
          </p>

          {collectionsState.status === "loading" ? (
            <EmptyState size="sm" className="p-4 mt-6">
              {t("Loading your collections...")}
            </EmptyState>
          ) : collectionsState.status === "error" ? (
            <Alert className="p-4 mt-6">
              {t(collectionsState.error ?? "We couldn't load your collections.")}
            </Alert>
          ) : collectionsState.data.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-border bg-background/80 p-4 text-sm text-muted-strong">
              {t("No collections yet. Create one to start cataloguing.")}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {recentCollections.map((collection) => (
                <div
                  key={collection.id}
                  className="rounded-2xl border border-border bg-card/90 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5 text-brand" />
                      {collection.is_public ? t("Public") : t("Private")}
                    </span>
                    <span>
                      {t("Updated {date}", {
                        date: formatDate(collection.updated_at, locale)
                      })}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-foreground">
                    {collection.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-strong">
                    {collection.description ??
                      t(
                        "Add a description to capture the story behind this collection."
                      )}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5 text-brand" />
                        {t("Created {date}", {
                          date: formatDate(collection.created_at, locale)
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-brand" />
                        {tc(collection.star_count ?? 0, "{count} star", "{count} stars")}
                      </span>
                    </div>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/collections/${collection.id}`}>
                        {t("Open")}
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" asChild>
              <Link href="/collections">{t("View all collections")}</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/collections/new">{t("New collection")}</Link>
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card tone="subtle">
            <Eyebrow>
              {t("Recent activity")}
            </Eyebrow>
            <SectionHeading className="mt-3">
              {t("Latest updates from your archive.")}
            </SectionHeading>
            {activityState.status === "loading" && activityState.data.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {t("Loading activity...")}
              </p>
            ) : activityState.status === "error" && activityState.data.length === 0 ? (
              <p className="mt-4 text-sm text-destructive">
                {t(activityState.error ?? "Activity unavailable right now.")}
              </p>
            ) : activityState.data.length === 0 ? (
              <p className="mt-4 text-sm text-muted-strong">
                {t("No activity yet. Create a collection to start your timeline.")}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {activityState.data.map((entry) => {
                  const isNewItemEntry = entry.action_type === "item.created";
                  const targetHref =
                    entry.target_path ??
                    (entry.resource_type === "collection" && entry.resource_id
                      ? `/collections/${entry.resource_id}`
                      : null);
                  return (
                    <li
                      key={entry.id}
                      className="rounded-2xl border border-border bg-card p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Eyebrow tone="brand" spacing="tight">
                          {activityActionLabel(entry, t)}
                        </Eyebrow>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(entry.created_at, locale)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">
                          {describeActivity(entry, t)}
                        </p>
                        {targetHref ? (
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={targetHref}>
                              {isNewItemEntry ? t("View") : t("Open")}
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

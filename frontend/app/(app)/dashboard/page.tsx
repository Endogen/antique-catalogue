"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Folder } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  activityApi,
  collectionApi,
  isApiError,
  type ActivityLogResponse,
  type CollectionResponse
} from "@/lib/api";

type CollectionsState = {
  status: "loading" | "ready" | "error";
  data: CollectionResponse[];
  error?: string;
};

type ActivityState = {
  status: "loading" | "ready" | "error";
  data: ActivityLogResponse[];
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

const formatActionType = (value: string) => value.replace(/[._-]+/g, " ");

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [collectionsState, setCollectionsState] = React.useState<CollectionsState>({
    status: "loading",
    data: []
  });
  const [activityState, setActivityState] = React.useState<ActivityState>({
    status: "loading",
    data: []
  });

  const loadCollections = React.useCallback(async () => {
    setCollectionsState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));
    try {
      const data = await collectionApi.list();
      setCollectionsState({
        status: "ready",
        data
      });
    } catch (error) {
      setCollectionsState((prev) => ({
        status: "error",
        data: prev.data,
        error: isApiError(error)
          ? error.detail
          : "We couldn't load your collections."
      }));
    }
  }, []);

  const loadActivity = React.useCallback(async () => {
    setActivityState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));
    try {
      const data = await activityApi.list({ limit: 5 });
      setActivityState({
        status: "ready",
        data
      });
    } catch (error) {
      setActivityState((prev) => ({
        status: "error",
        data: prev.data,
        error: isApiError(error) ? error.detail : "Activity unavailable right now."
      }));
    }
  }, []);

  React.useEffect(() => {
    void loadCollections();
    void loadActivity();
  }, [loadActivity, loadCollections]);

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
        <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            {t("Your collections")}
          </p>
          <h2 className="font-display mt-3 text-2xl text-stone-900">
            {hasCollections
              ? t("Continue your catalogue.")
              : t("Start shaping your first collection.")}
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            {hasCollections
              ? t(
                  "Jump back into a collection to refine metadata, add items, and keep your archive up to date."
                )
              : t(
                  "Define the fields that matter most for your collection. Once you are ready, share access with collaborators and start capturing items."
                )}
          </p>

          {collectionsState.status === "loading" ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/60 p-4 text-sm text-stone-500">
              {t("Loading your collections...")}
            </div>
          ) : collectionsState.status === "error" ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-600">
              {t(collectionsState.error ?? "We couldn't load your collections.")}
            </div>
          ) : collectionsState.data.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-stone-600">
              {t("No collections yet. Create one to start cataloguing.")}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {recentCollections.map((collection) => (
                <div
                  key={collection.id}
                  className="rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span className="inline-flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5 text-amber-600" />
                      {collection.is_public ? t("Public") : t("Private")}
                    </span>
                    <span>
                      {t("Updated {date}", {
                        date: formatDate(collection.updated_at, locale)
                      })}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-stone-900">
                    {collection.name}
                  </h3>
                  <p className="mt-1 text-xs text-stone-600">
                    {collection.description ??
                      t(
                        "Add a description to capture the story behind this collection."
                      )}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-amber-600" />
                      {t("Created {date}", {
                        date: formatDate(collection.created_at, locale)
                      })}
                    </span>
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
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              {t("Recent activity")}
            </p>
            <h2 className="font-display mt-3 text-2xl text-stone-900">
              {t("Latest updates from your archive.")}
            </h2>
            {activityState.status === "loading" && activityState.data.length === 0 ? (
              <p className="mt-4 text-sm text-stone-500">
                {t("Loading activity...")}
              </p>
            ) : activityState.status === "error" && activityState.data.length === 0 ? (
              <p className="mt-4 text-sm text-rose-600">
                {t(activityState.error ?? "Activity unavailable right now.")}
              </p>
            ) : activityState.data.length === 0 ? (
              <p className="mt-4 text-sm text-stone-600">
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
                      className="rounded-2xl border border-stone-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-amber-700">
                          {formatActionType(entry.action_type)}
                        </p>
                        <span className="text-xs text-stone-500">
                          {formatDateTime(entry.created_at, locale)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-stone-900">
                          {entry.summary}
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
          </div>
        </div>
      </section>
    </div>
  );
}

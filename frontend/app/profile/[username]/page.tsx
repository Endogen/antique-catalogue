"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  Folder,
  Package,
  Search,
  Star
} from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { PublicHeader } from "@/components/public-header";
import { SocialShareActions } from "@/components/social-share-actions";
import { Button } from "@/components/ui/button";
import {
  avatarUrl,
  profileApi,
  type CollectionResponse,
  type PublicProfileResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { Card, EmptyState } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

export default function PublicProfilePage() {
  const params = useParams();
  const usernameParam = Array.isArray(params?.username)
    ? params.username[0]
    : params?.username;
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [collectionSearch, setCollectionSearch] = React.useState("");

  const profileQuery = useQuery({
    queryKey: queryKeys.profile.public(usernameParam ?? ""),
    queryFn: ({ signal }) => profileApi.getPublic(usernameParam!, { signal }),
    enabled: Boolean(usernameParam)
  });
  const collectionsQuery = useQuery({
    queryKey: queryKeys.profile.publicCollections(usernameParam ?? ""),
    queryFn: ({ signal }) =>
      profileApi.listPublicCollections(usernameParam!, { signal }),
    enabled: Boolean(usernameParam)
  });

  const state = toLoadState<PublicProfileResponse | null>(
    profileQuery,
    "Profile not found",
    null
  );
  const collectionsState = toLoadState<CollectionResponse[]>(
    collectionsQuery,
    "We couldn't load public collections.",
    []
  );

  const formatDate = React.useCallback(
    (value: string | null | undefined) => {
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
    },
    [locale]
  );

  const { refetch: refetchProfile } = profileQuery;
  const { refetch: refetchCollections } = collectionsQuery;
  const loadProfile = React.useCallback(() => {
    void refetchProfile();
  }, [refetchProfile]);
  const loadCollections = React.useCallback(() => {
    void refetchCollections();
  }, [refetchCollections]);

  const isOwnProfile = state.data?.username === user?.username;
  const filteredCollections = React.useMemo(() => {
    const term = collectionSearch.trim().toLowerCase();
    if (!term) {
      return collectionsState.data;
    }
    return collectionsState.data.filter((collection) => {
      const description = collection.description ?? "";
      return (
        collection.name.toLowerCase().includes(term) ||
        description.toLowerCase().includes(term)
      );
    });
  }, [collectionSearch, collectionsState.data]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-2 sm:pt-4 lg:px-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link href="/explore">
              <ArrowLeft className="h-4 w-4" />
              {t("Back to explore")}
            </Link>
          </Button>
          {isOwnProfile ? (
            <Button variant="secondary" size="sm" asChild>
              <Link href="/profile">{t("Edit profile")}</Link>
            </Button>
          ) : null}
        </div>
        {state.status === "loading" ? (
          <EmptyState>
            {t("Loading profile...")}
          </EmptyState>
        ) : state.status === "error" || !state.data ? (
          <Alert className="rounded-3xl p-8">
            <p className="text-sm font-medium text-destructive">{t("Profile not found")}</p>
            <p className="mt-2 text-sm text-destructive">
              {t(state.error ?? "Profile not found")}
            </p>
          </Alert>
        ) : (
          <div className="space-y-6">
            <Card>
              <Eyebrow tone="brand" spacing="wide">{t("Profile")}</Eyebrow>
              <div className="mt-4 flex items-center gap-4 sm:gap-5">
                <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20 overflow-hidden rounded-full border-2 border-border bg-muted">
                  {state.data.has_avatar ? (
                    <Image
                      src={avatarUrl(state.data.id, "medium")}
                      alt={state.data.username}
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-panel text-lg font-semibold text-panel-foreground">
                      {state.data.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <SectionHeading as="h1" size="xl" className="wrap-break-word">
                    @{state.data.username}
                  </SectionHeading>
                  <p className="mt-1 text-sm text-muted-strong">
                    {t("Member since {date}", { date: formatDate(state.data.created_at) })}
                  </p>
                </div>
              </div>
              <SocialShareActions
                className="mt-5"
                path={`/profile/${encodeURIComponent(state.data.username)}`}
                title={`@${state.data.username}`}
                text={`${state.data.public_collection_count} public collections · ${state.data.public_item_count} public items`}
              />
            </Card>

            <div className="rounded-3xl border border-panel-border bg-panel-deep p-5 text-panel-foreground">
              <Eyebrow tone="panel">
                {t("Public summary")}
              </Eyebrow>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-panel-border bg-panel/70 p-4">
                  <p className="inline-flex items-center gap-2 text-xs text-panel-muted-foreground">
                    <Folder className="h-4 w-4 text-amber-300" />
                    {t("Public collections")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-panel-foreground">
                    {state.data.public_collection_count}
                  </p>
                </div>
                <div className="rounded-2xl border border-panel-border bg-panel/70 p-4">
                  <p className="inline-flex items-center gap-2 text-xs text-panel-muted-foreground">
                    <Package className="h-4 w-4 text-amber-300" />
                    {t("Public items")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-panel-foreground">
                    {state.data.public_item_count}
                  </p>
                </div>
                <div className="rounded-2xl border border-panel-border bg-panel/70 p-4">
                  <p className="inline-flex items-center gap-2 text-xs text-panel-muted-foreground">
                    <Star className="h-4 w-4 text-amber-300" />
                    {t("Stars earned")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-panel-foreground">
                    {state.data.earned_star_count}
                  </p>
                </div>
                <div className="rounded-2xl border border-panel-border bg-panel/70 p-4">
                  <p className="inline-flex items-center gap-2 text-xs text-panel-muted-foreground">
                    <Award className="h-4 w-4 text-amber-300" />
                    {t("Star rank")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-panel-foreground">
                    #{state.data.star_rank}
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <Eyebrow>
                    {t("Public collections")}
                  </Eyebrow>
                  <SectionHeading className="mt-3">
                    {t("Browse public collections")}
                  </SectionHeading>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t("{count} total", {
                    count: collectionsState.data.length
                  })}
                </span>
              </div>

              <div className="relative mt-4 max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
                <input
                  type="search"
                  className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-3 text-sm text-muted-strong shadow-xs transition focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring"
                  placeholder={t("Search collections")}
                  value={collectionSearch}
                  onChange={(event) => setCollectionSearch(event.target.value)}
                />
              </div>

              {collectionsState.status === "loading" && collectionsState.data.length === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">{t("Loading collections...")}</p>
              ) : collectionsState.status === "error" && collectionsState.data.length === 0 ? (
                <p className="mt-6 text-sm text-destructive">
                  {t(collectionsState.error ?? "We couldn't load public collections.")}
                </p>
              ) : filteredCollections.length === 0 ? (
                <p className="mt-6 text-sm text-muted-strong">
                  {t("No collections available yet.")}
                </p>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {filteredCollections.map((collection) => (
                    <div
                      key={collection.id}
                      className="rounded-2xl border border-border bg-card/90 p-4 shadow-xs"
                    >
                      <h3 className="text-base font-semibold text-foreground">
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
                              date: formatDate(collection.created_at)
                            })}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-brand" />
                            {collection.star_count ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Folder className="h-3.5 w-3.5 text-brand" />
                            {collection.item_count ?? 0}
                          </span>
                        </div>
                        <Button size="sm" variant="secondary" asChild>
                          <Link href={`/explore/${collection.id}`}>{t("View collection")}</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </section>
    </main>
  );
}

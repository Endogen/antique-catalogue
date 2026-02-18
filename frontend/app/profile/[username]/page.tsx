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

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { SocialShareActions } from "@/components/social-share-actions";
import { Button } from "@/components/ui/button";
import {
  avatarUrl,
  isApiError,
  profileApi,
  type CollectionResponse,
  type PublicProfileResponse
} from "@/lib/api";

type LoadState = {
  status: "loading" | "ready" | "error";
  data: PublicProfileResponse | null;
  error?: string;
};

type CollectionsState = {
  status: "loading" | "ready" | "error";
  data: CollectionResponse[];
  error?: string;
};

export default function PublicProfilePage() {
  const params = useParams();
  const usernameParam = Array.isArray(params?.username)
    ? params.username[0]
    : params?.username;
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [state, setState] = React.useState<LoadState>({
    status: "loading",
    data: null
  });
  const [collectionsState, setCollectionsState] = React.useState<CollectionsState>({
    status: "loading",
    data: []
  });
  const [collectionSearch, setCollectionSearch] = React.useState("");

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

  const loadProfile = React.useCallback(async () => {
    if (!usernameParam) {
      setState({
        status: "error",
        data: null,
        error: "Profile not found"
      });
      return;
    }
    setState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));
    try {
      const data = await profileApi.getPublic(usernameParam);
      setState({
        status: "ready",
        data
      });
    } catch (error) {
      setState((prev) => ({
        status: "error",
        data: prev.data,
        error: isApiError(error) ? error.detail : "Profile not found"
      }));
    }
  }, [usernameParam]);

  const loadCollections = React.useCallback(async () => {
    if (!usernameParam) {
      setCollectionsState({
        status: "error",
        data: [],
        error: "Profile not found"
      });
      return;
    }
    setCollectionsState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));
    try {
      const data = await profileApi.listPublicCollections(usernameParam);
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
          : "We couldn't load public collections."
      }));
    }
  }, [usernameParam]);

  React.useEffect(() => {
    void loadProfile();
    void loadCollections();
  }, [loadCollections, loadProfile]);

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
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <header className="border-b border-stone-200/80 bg-stone-50/80 px-6 py-6 backdrop-blur lg:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Antique Catalogue"
              width={44}
              height={44}
              className="rounded-full"
            />
            <div>
              <p className="font-display text-lg tracking-tight">{t("Antique Catalogue")}</p>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                {t("Studio Archive")}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
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
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-12">
        {state.status === "loading" ? (
          <div className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500">
            {t("Loading profile...")}
          </div>
        ) : state.status === "error" || !state.data ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-8">
            <p className="text-sm font-medium text-rose-700">{t("Profile not found")}</p>
            <p className="mt-2 text-sm text-rose-600">
              {t(state.error ?? "Profile not found")}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.4em] text-amber-700">{t("Profile")}</p>
              <div className="mt-4 flex items-center gap-5">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-stone-200 bg-stone-100">
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
                    <div className="flex h-full w-full items-center justify-center bg-stone-900 text-lg font-semibold text-stone-50">
                      {state.data.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="font-display text-3xl text-stone-900">
                    @{state.data.username}
                  </h1>
                  <p className="mt-1 text-sm text-stone-600">
                    {t("Member since {date}", { date: formatDate(state.data.created_at) })}
                  </p>
                  <SocialShareActions
                    className="mt-4"
                    path={`/profile/${encodeURIComponent(state.data.username)}`}
                    title={`@${state.data.username}`}
                    text={`${state.data.public_collection_count} public collections · ${state.data.public_item_count} public items`}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-900 bg-stone-950 p-5 text-stone-100">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                {t("Public summary")}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
                  <p className="inline-flex items-center gap-2 text-xs text-stone-300">
                    <Folder className="h-4 w-4 text-amber-300" />
                    {t("Public collections")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-stone-100">
                    {state.data.public_collection_count}
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
                  <p className="inline-flex items-center gap-2 text-xs text-stone-300">
                    <Package className="h-4 w-4 text-amber-300" />
                    {t("Public items")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-stone-100">
                    {state.data.public_item_count}
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
                  <p className="inline-flex items-center gap-2 text-xs text-stone-300">
                    <Star className="h-4 w-4 text-amber-300" />
                    {t("Stars earned")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-stone-100">
                    {state.data.earned_star_count}
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-800 bg-stone-900/70 p-4">
                  <p className="inline-flex items-center gap-2 text-xs text-stone-300">
                    <Award className="h-4 w-4 text-amber-300" />
                    {t("Star rank")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-stone-100">
                    #{state.data.star_rank}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                    {t("Public collections")}
                  </p>
                  <h2 className="font-display mt-3 text-2xl text-stone-900">
                    {t("Browse public collections")}
                  </h2>
                </div>
                <span className="text-xs text-stone-500">
                  {t("{count} total", {
                    count: collectionsState.data.length
                  })}
                </span>
              </div>

              <div className="relative mt-4 max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="search"
                  className="h-10 w-full rounded-full border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-700 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder={t("Search collections")}
                  value={collectionSearch}
                  onChange={(event) => setCollectionSearch(event.target.value)}
                />
              </div>

              {collectionsState.status === "loading" && collectionsState.data.length === 0 ? (
                <p className="mt-6 text-sm text-stone-500">{t("Loading collections...")}</p>
              ) : collectionsState.status === "error" && collectionsState.data.length === 0 ? (
                <p className="mt-6 text-sm text-rose-600">
                  {t(collectionsState.error ?? "We couldn't load public collections.")}
                </p>
              ) : filteredCollections.length === 0 ? (
                <p className="mt-6 text-sm text-stone-600">
                  {t("No collections available yet.")}
                </p>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {filteredCollections.map((collection) => (
                    <div
                      key={collection.id}
                      className="rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm"
                    >
                      <h3 className="text-base font-semibold text-stone-900">
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
                              date: formatDate(collection.created_at)
                            })}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-amber-600" />
                            {collection.star_count ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Folder className="h-3.5 w-3.5 text-amber-600" />
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
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

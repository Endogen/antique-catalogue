"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Globe2,
  LogOut,
  RefreshCcw,
  Search,
  Star
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import {
  isApiError,
  publicCollectionApi,
  type CollectionResponse
} from "@/lib/api";

type LoadState = {
  status: "loading" | "ready" | "error";
  data: CollectionResponse[];
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
    return (
      collection.name.toLowerCase().includes(normalized) ||
      description.toLowerCase().includes(normalized)
    );
  });
};

export default function ExplorePage() {
  const { isAuthenticated, logout, status: authStatus } = useAuth();
  const { t, locale } = useI18n();
  const [state, setState] = React.useState<LoadState>({
    status: "loading",
    data: []
  });
  const [search, setSearch] = React.useState("");
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const loadCollections = React.useCallback(async () => {
    setState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));
    try {
      const data = await publicCollectionApi.list();
      setState({
        status: "ready",
        data
      });
    } catch (error) {
      setState((prev) => ({
        status: "error",
        data: prev.data,
        error: isApiError(error)
          ? error.detail
          : "We couldn't load public collections."
      }));
    }
  }, []);

  React.useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  const filtered = React.useMemo(
    () => filterCollections(state.data, search.trim()),
    [state.data, search]
  );

  const totalCount = state.data.length;
  const showAuthenticatedCtas =
    authStatus === "authenticated" && isAuthenticated;

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-stone-50 text-stone-950">
      <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-amber-300/20 blur-[100px]" />
      <div className="pointer-events-none absolute top-[35%] left-[-8%] h-72 w-72 rounded-full bg-amber-200/25 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-8%] h-80 w-80 rounded-full bg-stone-900/10 blur-[160px]" />
      <div className="relative z-10">
        <header className="px-6 py-6 lg:px-12">
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
                <p className="font-display text-lg tracking-tight">
                  {t("Antique Catalogue")}
                </p>
                <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                  {t("Studio Archive")}
                </p>
              </div>
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-stone-600 md:flex">
              <Link href="/" className="hover:text-stone-900">
                {t("Home")}
              </Link>
              <Link href="/explore" className="font-medium text-stone-900">
                {t("Explore")}
              </Link>
              <Link href="/dashboard" className="hover:text-stone-900">
                {t("Dashboard")}
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              {showAuthenticatedCtas ? (
                <Button
                  variant="secondary"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? t("Logging out...") : t("Log out")}
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    className="hidden sm:inline-flex"
                    asChild
                  >
                    <Link href="/login">{t("Log in")}</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/register">{t("Create account")}</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        <section>
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-12 pt-6 lg:flex-row lg:items-center lg:px-12 lg:pt-12">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
                {t("Public directory")}
              </p>
              <h1 className="font-display mt-4 text-4xl text-stone-900 sm:text-5xl">
                {t("Explore shared collections and curated archives.")}
              </h1>
              <p className="mt-4 max-w-xl text-sm text-stone-600 sm:text-base">
                {t(
                  "Browse public catalogues to discover provenance notes, condition details, and restoration history from collectors worldwide."
                )}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href="/register">{t("Start your own archive")}</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/dashboard">{t("Go to dashboard")}</Link>
                </Button>
              </div>
              <div className="mt-8 rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm">
                <label className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  {t("Search collections")}
                </label>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-sm">
                  <Search className="h-4 w-4 text-stone-400" />
                  <input
                    type="search"
                    className="w-full text-sm text-stone-700 focus:outline-none"
                    placeholder={t("Search by collection name or description")}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <p className="mt-3 text-xs text-stone-500">
                  {t("Showing {shown} of {total} public collections.", {
                    shown: filtered.length,
                    total: totalCount
                  })}
                </p>
              </div>
            </div>
            <div className="flex-1">
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)]">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                    {t("Directory snapshot")}
                  </p>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    {t("Live")}
                  </span>
                </div>
                <h2 className="font-display mt-4 text-2xl text-stone-900">
                  {t("Public collections")}
                </h2>
                <p className="mt-3 text-sm text-stone-600">
                  {t(
                    "Discover what others are cataloguing and share your own collection when you are ready."
                  )}
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                      {t("Total")}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-stone-900">
                      {state.status === "ready" ? totalCount : "-"}
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      {t("Shared archives")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                      {t("Access")}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-stone-900">
                      {t("Free")}
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      {t("Read-only browsing")}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between rounded-2xl bg-stone-900 px-4 py-3 text-stone-100">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                      {t("Publish your work")}
                    </p>
                    <p className="text-sm font-medium">
                      {t("Share curated catalogues publicly.")}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href="/collections/new">{t("Create collection")}</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                {t("Public collections")}
              </p>
              <h2 className="font-display mt-3 text-2xl text-stone-900">
                {t("Browse the directory.")}
              </h2>
            </div>
            <Button variant="outline" onClick={() => loadCollections()}>
              <RefreshCcw className="h-4 w-4" />
              {t("Refresh")}
            </Button>
          </div>

          {state.status === "loading" ? (
            <div
              className="mt-6 rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
              aria-busy="true"
            >
              {t("Loading public collections...")}
            </div>
          ) : state.status === "error" ? (
            <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
              <p className="text-sm font-medium text-rose-700">
                {t("We hit a snag loading the directory.")}
              </p>
              <p className="mt-2 text-sm text-rose-600">
                {t(state.error ?? "Please try again.")}
              </p>
              <div className="mt-4">
                <Button variant="outline" onClick={() => loadCollections()}>
                  {t("Try again")}
                </Button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-stone-200 bg-white/80 p-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                    {t("No matches")}
                  </p>
                  <h3 className="font-display mt-3 text-2xl text-stone-900">
                    {t("We could not find collections for that search.")}
                  </h3>
                  <p className="mt-3 max-w-xl text-sm text-stone-600">
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
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <Globe2 className="h-8 w-8" />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filtered.map((collection) => (
                <div
                  key={collection.id}
                  className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      <Globe2 className="h-3.5 w-3.5" />
                      {t("Public")}
                    </span>
                    <span className="text-xs text-stone-500">
                      {t("Updated {date}", {
                        date: formatDate(collection.updated_at, locale)
                      })}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-stone-900">
                    {collection.name}
                  </h3>
                  <p className="mt-2 text-sm text-stone-600">
                    {collection.description ??
                      t("This collection is ready to be explored.")}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-amber-600" />
                        {t("Created {date}", {
                          date: formatDate(collection.created_at, locale)
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-4 w-4 text-amber-600" />
                        {t("{count} stars", {
                          count: collection.star_count ?? 0
                        })}
                      </span>
                    </div>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/explore/${collection.id}`}>
                        {t("View collection")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

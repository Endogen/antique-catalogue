"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Globe2,
  RefreshCcw,
  Search
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

const formatDate = (value?: string | null) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
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
  const [state, setState] = React.useState<LoadState>({
    status: "loading",
    data: []
  });
  const [search, setSearch] = React.useState("");

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

  return (
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <header className="px-6 py-6 lg:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-stone-50">
              AC
            </div>
            <div>
              <p className="font-display text-lg tracking-tight">
                Antique Catalogue
              </p>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                Studio Archive
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-stone-600 md:flex">
            <Link href="/" className="hover:text-stone-900">
              Home
            </Link>
            <Link
              href="/explore"
              className="font-medium text-stone-900"
            >
              Explore
            </Link>
            <Link href="/dashboard" className="hover:text-stone-900">
              Dashboard
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hidden sm:inline-flex" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Create account</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-amber-300/20 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-64 w-64 rounded-full bg-stone-900/10 blur-[120px]" />
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-12 pt-6 lg:flex-row lg:items-center lg:px-12 lg:pt-12">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              Public directory
            </p>
            <h1 className="font-display mt-4 text-4xl text-stone-900 sm:text-5xl">
              Explore shared collections and curated archives.
            </h1>
            <p className="mt-4 max-w-xl text-sm text-stone-600 sm:text-base">
              Browse public catalogues to discover provenance notes, condition
              details, and restoration history from collectors worldwide.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/register">Start your own archive</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
            <div className="mt-8 rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm">
              <label className="text-xs uppercase tracking-[0.3em] text-stone-500">
                Search collections
              </label>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-sm">
                <Search className="h-4 w-4 text-stone-400" />
                <input
                  type="search"
                  className="w-full text-sm text-stone-700 focus:outline-none"
                  placeholder="Search by collection name or description"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <p className="mt-3 text-xs text-stone-500">
                Showing {filtered.length} of {totalCount} public collections.
              </p>
            </div>
          </div>
          <div className="flex-1">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                  Directory snapshot
                </p>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  Live
                </span>
              </div>
              <h2 className="font-display mt-4 text-2xl text-stone-900">
                Public collections
              </h2>
              <p className="mt-3 text-sm text-stone-600">
                Discover what others are cataloguing and share your own
                collection when you are ready.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                    Total
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-stone-900">
                    {state.status === "ready" ? totalCount : "-"}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">
                    Shared archives
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                    Access
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-stone-900">
                    Free
                  </p>
                  <p className="mt-2 text-xs text-stone-500">
                    Read-only browsing
                  </p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between rounded-2xl bg-stone-900 px-4 py-3 text-stone-100">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                    Publish your work
                  </p>
                  <p className="text-sm font-medium">
                    Share curated catalogues publicly.
                  </p>
                </div>
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/collections/new">Create collection</Link>
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
              Public collections
            </p>
            <h2 className="font-display mt-3 text-2xl text-stone-900">
              Browse the directory.
            </h2>
          </div>
          <Button variant="outline" onClick={() => loadCollections()}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {state.status === "loading" ? (
          <div
            className="mt-6 rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
            aria-busy="true"
          >
            Loading public collections...
          </div>
        ) : state.status === "error" ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
            <p className="text-sm font-medium text-rose-700">
              We hit a snag loading the directory.
            </p>
            <p className="mt-2 text-sm text-rose-600">
              {state.error ?? "Please try again."}
            </p>
            <div className="mt-4">
              <Button variant="outline" onClick={() => loadCollections()}>
                Try again
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-stone-200 bg-white/80 p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  No matches
                </p>
                <h3 className="font-display mt-3 text-2xl text-stone-900">
                  We could not find collections for that search.
                </h3>
                <p className="mt-3 max-w-xl text-sm text-stone-600">
                  Try adjusting your search terms or refresh to see the latest
                  public catalogues.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                  <Button asChild>
                    <Link href="/register">Create your own</Link>
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
                    Public
                  </span>
                  <span className="text-xs text-stone-500">
                    Updated {formatDate(collection.updated_at)}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-stone-900">
                  {collection.name}
                </h3>
                <p className="mt-2 text-sm text-stone-600">
                  {collection.description ??
                    "This collection is ready to be explored."}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <CalendarDays className="h-4 w-4 text-amber-600" />
                    Created {formatDate(collection.created_at)}
                  </div>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/explore/${collection.id}`}>
                      View collection
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

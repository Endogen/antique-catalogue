"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Folder,
  Globe2,
  Lock,
  Plus,
  RefreshCcw,
  Sparkles
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  collectionApi,
  isApiError,
  type CollectionResponse
} from "@/lib/api";

type LoadState = {
  status: "loading" | "ready" | "error";
  data: CollectionResponse[];
  error?: string;
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "—";
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

const getVisibilityMeta = (collection: CollectionResponse) => {
  if (collection.is_public) {
    return {
      label: "Public",
      Icon: Globe2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700"
    };
  }
  return {
    label: "Private",
    Icon: Lock,
    className: "border-amber-200 bg-amber-50 text-amber-700"
  };
};

export default function CollectionsPage() {
  const [state, setState] = React.useState<LoadState>({
    status: "loading",
    data: []
  });

  const loadCollections = React.useCallback(async () => {
    setState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));
    try {
      const data = await collectionApi.list();
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
          : "We couldn't load your collections."
      }));
    }
  }, []);

  React.useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  const totalCount = state.data.length;
  const publicCount = state.data.filter((collection) => collection.is_public)
    .length;
  const privateCount = totalCount - publicCount;
  const totalItems = state.data.reduce(
    (sum, collection) => sum + (collection.item_count ?? 0),
    0
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
            Collections
          </p>
          <h1 className="font-display mt-4 text-3xl text-stone-900">
            Curate and organize your archive.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-stone-600">
            Build collections for every category of antique, then capture
            metadata, imagery, and provenance in one focused workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => loadCollections()}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/collections/new">
              <Plus className="h-4 w-4" />
              Create collection
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white/80 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
            Total items
          </p>
          <p className="mt-4 text-3xl font-semibold text-stone-900">
            {totalItems}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Catalogued across your collections.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white/80 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
            Total collections
          </p>
          <p className="mt-4 text-3xl font-semibold text-stone-900">
            {totalCount}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            All archives in your studio.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white/80 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
            Public collections
          </p>
          <p className="mt-4 text-3xl font-semibold text-stone-900">
            {publicCount}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Visible in the public directory.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white/80 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
            Private collections
          </p>
          <p className="mt-4 text-3xl font-semibold text-stone-900">
            {privateCount}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Internal research and drafts.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              Your archive
            </p>
            <h2 className="font-display mt-3 text-2xl text-stone-900">
              Active collections
            </h2>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/explore">
              <Sparkles className="h-4 w-4" />
              Explore public collections
            </Link>
          </Button>
        </div>

        {state.status === "loading" ? (
          <div
            className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
            aria-busy="true"
          >
            Loading your collections...
          </div>
        ) : state.status === "error" ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
            <p className="text-sm font-medium text-rose-700">
              We hit a snag loading collections.
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
        ) : state.data.length === 0 ? (
          <div className="rounded-3xl border border-stone-200 bg-white/80 p-8 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  No collections yet
                </p>
                <h3 className="font-display mt-3 text-2xl text-stone-900">
                  Start by defining your first collection.
                </h3>
                <p className="mt-3 max-w-xl text-sm text-stone-600">
                  Create a collection to set up metadata fields, then begin
                  documenting items and images from any device.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/collections/new">
                      <Plus className="h-4 w-4" />
                      Create collection
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/explore">Browse public catalogues</Link>
                  </Button>
                </div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Folder className="h-8 w-8" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {state.data.map((collection) => {
              const meta = getVisibilityMeta(collection);
              const itemCount = collection.item_count ?? 0;
              const itemLabel = itemCount === 1 ? "item" : "items";
              return (
                <div
                  key={collection.id}
                  className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${meta.className}`}
                    >
                      <meta.Icon className="h-3.5 w-3.5" />
                      {meta.label}
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
                      "Add a description to capture the story behind this collection."}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-amber-600" />
                        Created {formatDate(collection.created_at)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-amber-600" />
                        {itemCount} {itemLabel}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/collections/${collection.id}`}>
                          View collection
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/collections/${collection.id}/settings`}>
                          Collection settings
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

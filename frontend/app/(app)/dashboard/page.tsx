"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Folder } from "lucide-react";

import { Button } from "@/components/ui/button";
import { collectionApi, isApiError, type CollectionResponse } from "@/lib/api";

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

export default function DashboardPage() {
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
  const hasCollections = state.status === "ready" && totalCount > 0;
  const recentCollections = React.useMemo(() => {
    return [...state.data]
      .sort((a, b) => {
        const aDate = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
        const bDate = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 2);
  }, [state.data]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.4em] text-stone-500">
          Getting started
        </p>
        <h1 className="font-display mt-4 text-3xl text-stone-900">
          {hasCollections
            ? "Your archive is in motion."
            : "Your archive is ready for its first collection."}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-stone-600">
          {hasCollections
            ? "Pick up where you left off, refine metadata, and keep adding items and imagery."
            : "Create a collection to define your metadata schema, then begin adding items and imagery. Everything stays organized in one place."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {hasCollections ? (
            <>
              <Button asChild>
                <Link href="/collections">View collections</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/collections/new">New collection</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild>
                <Link href="/collections/new">Create collection</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/explore">Browse public collections</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            Your collections
          </p>
          <h2 className="font-display mt-3 text-2xl text-stone-900">
            {hasCollections
              ? "Continue your catalogue."
              : "Start shaping your first collection."}
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            {hasCollections
              ? "Jump back into a collection to refine metadata, add items, and keep your archive up to date."
              : "Define the fields that matter most for your collection. Once you are ready, share access with collaborators and start capturing items."}
          </p>

          {state.status === "loading" ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/60 p-4 text-sm text-stone-500">
              Loading your collections...
            </div>
          ) : state.status === "error" ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-600">
              {state.error ?? "We couldn't load your collections."}
            </div>
          ) : state.data.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-sm text-stone-600">
              No collections yet. Create one to start cataloguing.
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
                      {collection.is_public ? "Public" : "Private"}
                    </span>
                    <span>Updated {formatDate(collection.updated_at)}</span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-stone-900">
                    {collection.name}
                  </h3>
                  <p className="mt-1 text-xs text-stone-600">
                    {collection.description ??
                      "Add a description to capture the story behind this collection."}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-amber-600" />
                      Created {formatDate(collection.created_at)}
                    </span>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/collections/${collection.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" asChild>
              <Link href="/collections">View all collections</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/collections/new">New collection</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-6 text-stone-100 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
            Studio checklist
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              Sketch your first collection story.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              Prepare a lighting setup for mobile photos.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              Invite a collaborator when you are ready.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

"use client";

import * as React from "react";
import {
  CalendarDays,
  Crown,
  LogOut,
  RefreshCcw,
  Shield
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  adminApi,
  getAdminToken,
  isApiError,
  type AdminCollectionResponse,
  type AdminFeaturedItemResponse,
  type AdminStatsResponse
} from "@/lib/api";

const PAGE_SIZE = 10;
const MAX_FEATURED_ITEMS = 4;

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

export default function AdminPage() {
  const [isReady, setIsReady] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<AdminStatsResponse | null>(null);
  const [collections, setCollections] = React.useState<
    AdminCollectionResponse[]
  >([]);
  const [featuredItemsState, setFeaturedItemsState] = React.useState<{
    status: "idle" | "loading" | "ready" | "error";
    data: AdminFeaturedItemResponse[];
    error?: string;
  }>({ status: "idle", data: [] });
  const [featuredItemSelection, setFeaturedItemSelection] = React.useState<
    number[]
  >([]);
  const [featuredItemsMessage, setFeaturedItemsMessage] = React.useState<
    string | null
  >(null);
  const [featuredItemsError, setFeaturedItemsError] = React.useState<
    string | null
  >(null);
  const [featuredItemsPending, setFeaturedItemsPending] = React.useState(false);
  const [totalCollections, setTotalCollections] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [featurePending, setFeaturePending] = React.useState<number | null>(null);

  const loadAdminData = React.useCallback(
    async (pageIndex: number) => {
      setStatus("loading");
      setErrorMessage(null);
      try {
        const [statsResponse, collectionsResponse] = await Promise.all([
          adminApi.stats(),
          adminApi.collections({
            offset: pageIndex * PAGE_SIZE,
            limit: PAGE_SIZE,
            publicOnly: true
          })
        ]);
        setStats(statsResponse);
        setCollections(collectionsResponse.items);
        setTotalCollections(collectionsResponse.total_count);
        setStatus("idle");
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          isApiError(error)
            ? error.detail
            : "We couldn't load admin data."
        );
      }
    },
    []
  );

  React.useEffect(() => {
    const token = getAdminToken();
    setIsAuthenticated(Boolean(token));
    setIsReady(true);
    if (token) {
      void loadAdminData(0);
    }
  }, [loadAdminData]);

  React.useEffect(() => {
    if (isAuthenticated) {
      void loadAdminData(page);
    }
  }, [isAuthenticated, page, loadAdminData]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    try {
      await adminApi.login({ email, password });
      setIsAuthenticated(true);
      setPage(0);
    } catch (error) {
      setLoginError(
        isApiError(error)
          ? error.detail
          : "Unable to sign in to the admin console."
      );
    }
  };

  const handleLogout = () => {
    adminApi.logout();
    setIsAuthenticated(false);
    setStats(null);
    setCollections([]);
    setTotalCollections(0);
    setFeaturedItemsState({ status: "idle", data: [] });
    setFeaturedItemSelection([]);
    setFeaturedItemsMessage(null);
    setFeaturedItemsError(null);
  };

  const handleFeature = async (collectionId: number | null) => {
    setFeaturePending(collectionId ?? -1);
    try {
      await adminApi.feature(collectionId);
      await loadAdminData(page);
    } catch (error) {
      setErrorMessage(
        isApiError(error) ? error.detail : "Unable to update featured collection."
      );
    } finally {
      setFeaturePending(null);
    }
  };

  const loadFeaturedItems = React.useCallback(
    async (collectionId: number | null | undefined) => {
      if (!collectionId) {
        setFeaturedItemsState({ status: "ready", data: [] });
        setFeaturedItemSelection([]);
        setFeaturedItemsMessage(null);
        return;
      }
      setFeaturedItemsState((prev) => ({
        ...prev,
        status: "loading",
        error: undefined
      }));
      setFeaturedItemsError(null);
      setFeaturedItemsMessage(null);
      try {
        const items = await adminApi.featuredItems();
        setFeaturedItemsState({ status: "ready", data: items });
        setFeaturedItemSelection(
          items.filter((item) => item.is_featured).map((item) => item.id)
        );
      } catch (error) {
        setFeaturedItemsState((prev) => ({
          status: "error",
          data: prev.data,
          error: isApiError(error)
            ? error.detail
            : "Unable to load featured items."
        }));
      }
    },
    []
  );

  React.useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void loadFeaturedItems(stats?.featured_collection_id ?? null);
  }, [isAuthenticated, stats?.featured_collection_id, loadFeaturedItems]);

  const selectionCount = featuredItemSelection.length;
  const selectionFull = selectionCount >= MAX_FEATURED_ITEMS;

  const toggleFeaturedItem = (itemId: number) => {
    setFeaturedItemsMessage(null);
    setFeaturedItemsError(null);
    setFeaturedItemSelection((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      if (prev.length >= MAX_FEATURED_ITEMS) {
        return prev;
      }
      return [...prev, itemId];
    });
  };

  const handleSaveFeaturedItems = async () => {
    if (!stats?.featured_collection_id || featuredItemsPending) {
      return;
    }
    setFeaturedItemsPending(true);
    setFeaturedItemsMessage(null);
    setFeaturedItemsError(null);
    try {
      await adminApi.setFeaturedItems(featuredItemSelection);
      await loadFeaturedItems(stats.featured_collection_id);
      setFeaturedItemsMessage("Featured items updated.");
    } catch (error) {
      setFeaturedItemsError(
        isApiError(error) ? error.detail : "Unable to update featured items."
      );
    } finally {
      setFeaturedItemsPending(false);
    }
  };

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-stone-500">
        Loading admin console...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-50 px-6 py-12">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-stone-200 bg-white/90 p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-stone-50">
              AC
            </div>
            <div>
              <p className="font-display text-lg tracking-tight">
                Admin Console
              </p>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                Antique Catalogue
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-stone-600">
            Sign in with your admin credentials to manage featured collections.
          </p>

          {loginError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {loginError}
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="text-xs font-medium text-stone-700" htmlFor="admin-email">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-700" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCollections / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              Admin
            </p>
            <h1 className="font-display mt-3 text-3xl text-stone-900">
              Catalogue administration
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              Monitor platform activity and select a featured collection.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => loadAdminData(page)}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
              Total users
            </p>
            <p className="mt-4 text-3xl font-semibold text-stone-900">
              {stats?.total_users ?? "-"}
            </p>
            <p className="mt-2 text-sm text-stone-500">Registered accounts</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
              Total collections
            </p>
            <p className="mt-4 text-3xl font-semibold text-stone-900">
              {stats?.total_collections ?? "-"}
            </p>
            <p className="mt-2 text-sm text-stone-500">Across all users</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
              Featured collection
            </p>
            <p className="mt-4 text-3xl font-semibold text-stone-900">
              {stats?.featured_collection_id ?? "-"}
            </p>
            <p className="mt-2 text-sm text-stone-500">
              Current featured ID
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                Featured selection
              </p>
              <h2 className="font-display mt-3 text-2xl text-stone-900">
                Choose a public collection to highlight.
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                Collections are sorted by newest first.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => handleFeature(null)}
              disabled={featurePending !== null}
            >
              <Shield className="h-4 w-4" />
              Clear featured
            </Button>
          </div>

          {status === "loading" ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
              Loading collections...
            </div>
          ) : collections.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
              No collections available yet.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  className="rounded-2xl border border-stone-200 bg-white/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                        Collection #{collection.id}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-stone-900">
                        {collection.name}
                      </h3>
                      <p className="mt-2 text-sm text-stone-600">
                        {collection.description ?? "No description provided."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
                        <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1">
                          Owner: {collection.owner_email}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1">
                          {collection.is_public ? "Public" : "Private"}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(collection.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {collection.is_featured ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          <Crown className="h-3.5 w-3.5" />
                          Featured
                        </span>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleFeature(collection.id)}
                        disabled={
                          featurePending !== null || !collection.is_public
                        }
                      >
                        {collection.is_public ? "Feature" : "Private"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-stone-500">
                <span>
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPage((prev) =>
                        Math.min(totalPages - 1, prev + 1)
                      )
                    }
                    disabled={page >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                Featured items
              </p>
              <h2 className="font-display mt-3 text-2xl text-stone-900">
                Curate highlights from the featured collection.
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                Select up to {MAX_FEATURED_ITEMS} items to spotlight on the
                homepage.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
              <span>
                {selectionCount} of {MAX_FEATURED_ITEMS} selected
              </span>
              <Button
                variant="outline"
                onClick={handleSaveFeaturedItems}
                disabled={
                  !stats?.featured_collection_id ||
                  featuredItemsPending ||
                  featuredItemsState.status !== "ready"
                }
              >
                <Crown className="h-4 w-4" />
                {featuredItemsPending ? "Saving..." : "Save featured"}
              </Button>
            </div>
          </div>

          {featuredItemsMessage ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {featuredItemsMessage}
            </div>
          ) : null}

          {featuredItemsError ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {featuredItemsError}
            </div>
          ) : null}

          {!stats?.featured_collection_id ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
              Choose a featured collection to manage highlighted items.
            </div>
          ) : featuredItemsState.status === "loading" ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
              Loading featured items...
            </div>
          ) : featuredItemsState.status === "error" ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {featuredItemsState.error ?? "Unable to load featured items."}
            </div>
          ) : featuredItemsState.data.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
              No items yet in this collection.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {featuredItemsState.data.map((item) => {
                const isSelected = featuredItemSelection.includes(item.id);
                const disableSelect = !isSelected && selectionFull;
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white/80 p-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        Added {formatDate(item.created_at)}
                      </p>
                      {item.notes ? (
                        <p className="mt-2 text-xs text-stone-500">
                          {item.notes}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant={isSelected ? "secondary" : "outline"}
                      onClick={() => toggleFeaturedItem(item.id)}
                      disabled={featuredItemsPending || disableSelect}
                    >
                      {isSelected ? "Featured" : "Feature"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import * as React from "react";
import {
  CalendarDays,
  Crown,
  Lock,
  LogOut,
  Package,
  RefreshCcw,
  Shield,
  Trash2,
  Users
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import {
  adminApi,
  getAdminToken,
  isApiError,
  type AdminCollectionResponse,
  type AdminFeaturedItemResponse,
  type AdminItemResponse,
  type AdminStatsResponse,
  type AdminUserResponse
} from "@/lib/api";

const PAGE_SIZE = 10;
const MAX_FEATURED_ITEMS = 4;

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

export default function AdminPage() {
  const { t, locale } = useI18n();
  const [isReady, setIsReady] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginError, setLoginError] = React.useState<string | null>(null);

  const [stats, setStats] = React.useState<AdminStatsResponse | null>(null);

  const [collections, setCollections] = React.useState<AdminCollectionResponse[]>([]);
  const [totalCollections, setTotalCollections] = React.useState(0);
  const [collectionsPage, setCollectionsPage] = React.useState(0);
  const [collectionsStatus, setCollectionsStatus] = React.useState<
    "idle" | "loading" | "error"
  >("idle");

  const [users, setUsers] = React.useState<AdminUserResponse[]>([]);
  const [totalUsers, setTotalUsers] = React.useState(0);
  const [usersPage, setUsersPage] = React.useState(0);
  const [usersStatus, setUsersStatus] = React.useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [usersError, setUsersError] = React.useState<string | null>(null);

  const [items, setItems] = React.useState<AdminItemResponse[]>([]);
  const [totalItems, setTotalItems] = React.useState(0);
  const [itemsPage, setItemsPage] = React.useState(0);
  const [itemsStatus, setItemsStatus] = React.useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [itemsError, setItemsError] = React.useState<string | null>(null);

  const [featuredItemsState, setFeaturedItemsState] = React.useState<{
    status: "idle" | "loading" | "ready" | "error";
    data: AdminFeaturedItemResponse[];
    error?: string;
  }>({ status: "idle", data: [] });
  const [featuredItemSelection, setFeaturedItemSelection] = React.useState<number[]>([]);
  const [featuredItemsMessage, setFeaturedItemsMessage] = React.useState<string | null>(null);
  const [featuredItemsError, setFeaturedItemsError] = React.useState<string | null>(null);
  const [featuredItemsPending, setFeaturedItemsPending] = React.useState(false);

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [featurePending, setFeaturePending] = React.useState<number | null>(null);
  const [userLockPending, setUserLockPending] = React.useState<number | null>(null);
  const [userDeletePending, setUserDeletePending] = React.useState<number | null>(null);
  const [itemDeletePending, setItemDeletePending] = React.useState<number | null>(null);

  const loadCollectionsData = React.useCallback(async (pageIndex: number) => {
    setCollectionsStatus("loading");
    setErrorMessage(null);
    try {
      const [statsResponse, collectionsResponse] = await Promise.all([
        adminApi.stats(),
        adminApi.collections({
          offset: pageIndex * PAGE_SIZE,
          limit: PAGE_SIZE
        })
      ]);
      setStats(statsResponse);
      setCollections(collectionsResponse.items);
      setTotalCollections(collectionsResponse.total_count);
      setCollectionsStatus("idle");
    } catch (error) {
      setCollectionsStatus("error");
      setErrorMessage(isApiError(error) ? error.detail : "We couldn't load admin data.");
    }
  }, []);

  const loadUsers = React.useCallback(async (pageIndex: number) => {
    setUsersStatus("loading");
    setUsersError(null);
    try {
      const response = await adminApi.users({
        offset: pageIndex * PAGE_SIZE,
        limit: PAGE_SIZE
      });
      setUsers(response.items);
      setTotalUsers(response.total_count);
      setUsersStatus("idle");
    } catch (error) {
      setUsersStatus("error");
      setUsersError(isApiError(error) ? error.detail : "Unable to load users.");
    }
  }, []);

  const loadItems = React.useCallback(async (pageIndex: number) => {
    setItemsStatus("loading");
    setItemsError(null);
    try {
      const response = await adminApi.items({
        offset: pageIndex * PAGE_SIZE,
        limit: PAGE_SIZE
      });
      setItems(response.items);
      setTotalItems(response.total_count);
      setItemsStatus("idle");
    } catch (error) {
      setItemsStatus("error");
      setItemsError(isApiError(error) ? error.detail : "Unable to load items.");
    }
  }, []);

  const loadFeaturedItems = React.useCallback(async (collectionId: number | null | undefined) => {
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
      const fetchedItems = await adminApi.featuredItems();
      setFeaturedItemsState({ status: "ready", data: fetchedItems });
      setFeaturedItemSelection(
        fetchedItems.filter((item) => item.is_featured).map((item) => item.id)
      );
    } catch (error) {
      setFeaturedItemsState((prev) => ({
        status: "error",
        data: prev.data,
        error: isApiError(error) ? error.detail : "Unable to load featured items."
      }));
    }
  }, []);

  React.useEffect(() => {
    const token = getAdminToken();
    setIsAuthenticated(Boolean(token));
    setIsReady(true);
    if (token) {
      void loadCollectionsData(0);
      void loadUsers(0);
      void loadItems(0);
    }
  }, [loadCollectionsData, loadUsers, loadItems]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void loadCollectionsData(collectionsPage);
  }, [isAuthenticated, collectionsPage, loadCollectionsData]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void loadUsers(usersPage);
  }, [isAuthenticated, usersPage, loadUsers]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void loadItems(itemsPage);
  }, [isAuthenticated, itemsPage, loadItems]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void loadFeaturedItems(stats?.featured_collection_id ?? null);
  }, [isAuthenticated, stats?.featured_collection_id, loadFeaturedItems]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    try {
      await adminApi.login({ email, password });
      setIsAuthenticated(true);
      setCollectionsPage(0);
      setUsersPage(0);
      setItemsPage(0);
      void loadCollectionsData(0);
      void loadUsers(0);
      void loadItems(0);
    } catch (error) {
      setLoginError(
        isApiError(error) ? error.detail : "Unable to sign in to the admin console."
      );
    }
  };

  const handleLogout = () => {
    adminApi.logout();
    setIsAuthenticated(false);
    setStats(null);
    setCollections([]);
    setTotalCollections(0);
    setUsers([]);
    setTotalUsers(0);
    setItems([]);
    setTotalItems(0);
    setFeaturedItemsState({ status: "idle", data: [] });
    setFeaturedItemSelection([]);
    setFeaturedItemsMessage(null);
    setFeaturedItemsError(null);
    setErrorMessage(null);
    setUsersError(null);
    setItemsError(null);
  };

  const handleRefreshAll = () => {
    setErrorMessage(null);
    setUsersError(null);
    setItemsError(null);
    void loadCollectionsData(collectionsPage);
    void loadUsers(usersPage);
    void loadItems(itemsPage);
    void loadFeaturedItems(stats?.featured_collection_id ?? null);
  };

  const handleFeature = async (collectionId: number | null) => {
    setFeaturePending(collectionId ?? -1);
    setErrorMessage(null);
    try {
      await adminApi.feature(collectionId);
      await loadCollectionsData(collectionsPage);
    } catch (error) {
      setErrorMessage(
        isApiError(error) ? error.detail : "Unable to update featured collection."
      );
    } finally {
      setFeaturePending(null);
    }
  };

  const handleToggleUserLock = async (user: AdminUserResponse) => {
    setUserLockPending(user.id);
    setUsersError(null);
    try {
      await adminApi.setUserLocked(user.id, user.is_active);
      await loadUsers(usersPage);
    } catch (error) {
      setUsersError(
        isApiError(error) ? error.detail : "Unable to update user lock status."
      );
    } finally {
      setUserLockPending(null);
    }
  };

  const handleDeleteUser = async (user: AdminUserResponse) => {
    const confirmed = window.confirm(
      t('Delete user "{email}"? This permanently removes their collections and items.', {
        email: user.email
      })
    );
    if (!confirmed) {
      return;
    }
    setUserDeletePending(user.id);
    setUsersError(null);
    try {
      await adminApi.deleteUser(user.id);
      await Promise.all([
        loadCollectionsData(collectionsPage),
        loadUsers(usersPage),
        loadItems(itemsPage)
      ]);
    } catch (error) {
      setUsersError(isApiError(error) ? error.detail : "Unable to delete user.");
    } finally {
      setUserDeletePending(null);
    }
  };

  const handleDeleteItem = async (item: AdminItemResponse) => {
    const confirmed = window.confirm(
      t('Delete item "{name}"? This cannot be undone.', { name: item.name })
    );
    if (!confirmed) {
      return;
    }
    setItemDeletePending(item.id);
    setItemsError(null);
    try {
      await adminApi.deleteItem(item.id);
      await loadItems(itemsPage);
      if (stats?.featured_collection_id === item.collection_id) {
        await loadFeaturedItems(item.collection_id);
      }
    } catch (error) {
      setItemsError(isApiError(error) ? error.detail : "Unable to delete item.");
    } finally {
      setItemDeletePending(null);
    }
  };

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
        {t("Loading admin console...")}
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
              <p className="font-display text-lg tracking-tight">{t("Admin Console")}</p>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                {t("Antique Catalogue")}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-stone-600">
            {t("Sign in with your admin credentials to manage users, collections, and featured content.")}
          </p>

          {loginError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {t(loginError)}
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="text-xs font-medium text-stone-700" htmlFor="admin-email">
                {t("Email")}
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
                {t("Password")}
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
              {t("Sign in")}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const totalCollectionPages = Math.max(1, Math.ceil(totalCollections / PAGE_SIZE));
  const totalUsersPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const totalItemsPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">{t("Admin")}</p>
            <h1 className="font-display mt-3 text-3xl text-stone-900">
              {t("Catalogue administration")}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {t("Monitor platform activity, moderate users, and curate featured content.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleRefreshAll}>
              <RefreshCcw className="h-4 w-4" />
              {t("Refresh")}
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              {t("Sign out")}
            </Button>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {t(errorMessage)}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">{t("Total users")}</p>
            <p className="mt-4 text-3xl font-semibold text-stone-900">{stats?.total_users ?? "-"}</p>
            <p className="mt-2 text-sm text-stone-500">{t("Registered accounts")}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
              {t("Total collections")}
            </p>
            <p className="mt-4 text-3xl font-semibold text-stone-900">
              {stats?.total_collections ?? "-"}
            </p>
            <p className="mt-2 text-sm text-stone-500">{t("Across all users")}</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
              {t("Featured collection")}
            </p>
            <p className="mt-4 text-3xl font-semibold text-stone-900">
              {stats?.featured_collection_id ?? "-"}
            </p>
            <p className="mt-2 text-sm text-stone-500">{t("Current featured ID")}</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <section className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  {t("Featured selection")}
                </p>
                <h2 className="font-display mt-3 text-2xl text-stone-900">
                  {t("Choose a public collection to highlight.")}
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  {t("Collections are sorted by newest first.")}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => handleFeature(null)}
                disabled={featurePending !== null}
              >
                <Shield className="h-4 w-4" />
                {t("Clear featured")}
              </Button>
            </div>

            {collectionsStatus === "loading" ? (
              <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("Loading collections...")}
              </div>
            ) : collections.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("No collections available yet.")}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="rounded-2xl border border-stone-200 bg-white/80 p-4"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                          {t("Collection #{id}", { id: collection.id })}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-stone-900">
                          {collection.name}
                        </h3>
                        <p className="mt-2 text-sm text-stone-600">
                          {collection.description ?? t("No description provided.")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
                          <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1">
                            {t("Owner: {email}", {
                              email: collection.owner_email
                            })}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1">
                            {collection.is_public ? t("Public") : t("Private")}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(collection.created_at, locale)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {collection.is_featured ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                            <Crown className="h-3.5 w-3.5" />
                            {t("Featured")}
                          </span>
                        ) : null}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleFeature(collection.id)}
                          disabled={featurePending !== null || !collection.is_public}
                        >
                          {collection.is_public ? t("Feature") : t("Private")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-stone-500">
                  <span>
                    {t("Page {page} of {total}", {
                      page: collectionsPage + 1,
                      total: totalCollectionPages
                    })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCollectionsPage((prev) => Math.max(0, prev - 1))}
                      disabled={collectionsPage === 0}
                    >
                      {t("Previous")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCollectionsPage((prev) => Math.min(totalCollectionPages - 1, prev + 1))
                      }
                      disabled={collectionsPage >= totalCollectionPages - 1}
                    >
                      {t("Next")}
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
                  {t("Featured items")}
                </p>
                <h2 className="font-display mt-3 text-2xl text-stone-900">
                  {t("Curate highlights from the featured collection.")}
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  {t("Select up to {count} items to spotlight on the homepage.", {
                    count: MAX_FEATURED_ITEMS
                  })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                <span>
                  {t("{selected} of {count} selected", {
                    selected: selectionCount,
                    count: MAX_FEATURED_ITEMS
                  })}
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
                  {featuredItemsPending ? t("Saving...") : t("Save featured")}
                </Button>
              </div>
            </div>

            {featuredItemsMessage ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {t(featuredItemsMessage)}
              </div>
            ) : null}

            {featuredItemsError ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {t(featuredItemsError)}
              </div>
            ) : null}

            {!stats?.featured_collection_id ? (
              <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("Choose a featured collection to manage highlighted items.")}
              </div>
            ) : featuredItemsState.status === "loading" ? (
              <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("Loading featured items...")}
              </div>
            ) : featuredItemsState.status === "error" ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {t(featuredItemsState.error ?? "Unable to load featured items.")}
              </div>
            ) : featuredItemsState.data.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("No items yet in this collection.")}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {featuredItemsState.data.map((item) => {
                  const isSelected = featuredItemSelection.includes(item.id);
                  const disableSelect = !isSelected && selectionFull;
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl border border-stone-200 bg-white/80 p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-900">{item.name}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {t("Added {date}", {
                            date: formatDate(item.created_at, locale)
                          })}
                        </p>
                        {item.notes ? (
                          <p className="mt-2 text-xs text-stone-500">{item.notes}</p>
                        ) : null}
                      </div>
                      <Button
                        className="self-start"
                        size="sm"
                        variant={isSelected ? "secondary" : "outline"}
                        onClick={() => toggleFeaturedItem(item.id)}
                        disabled={featuredItemsPending || disableSelect}
                      >
                        {isSelected ? t("Featured") : t("Feature")}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <section className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  {t("User management")}
                </p>
                <h2 className="font-display mt-3 text-2xl text-stone-900">
                  {t("Review users, lock access, or remove accounts and their catalogue data.")}
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600">
                <Users className="h-3.5 w-3.5" />
                {t("Total users")}: {totalUsers}
              </span>
            </div>

            {usersError ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {t(usersError)}
              </div>
            ) : null}

            {usersStatus === "loading" ? (
              <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("Loading users...")}
              </div>
            ) : users.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("No users available yet.")}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-white/80 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{user.email}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {t("Username")}: {user.username}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 ${
                            user.is_active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                        >
                          {user.is_active ? t("Active") : t("Locked")}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-stone-600">
                          {user.is_verified ? t("Verified") : t("Unverified")}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-stone-600">
                          {t("Collections: {count}", { count: user.collection_count })}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-stone-600">
                          {t("Items: {count}", { count: user.item_count })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleUserLock(user)}
                        disabled={userLockPending !== null || userDeletePending !== null}
                      >
                        {userLockPending === user.id ? (
                          <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                        ) : user.is_active ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <Shield className="h-3.5 w-3.5" />
                        )}
                        {user.is_active ? t("Lock") : t("Unlock")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={() => handleDeleteUser(user)}
                        disabled={userDeletePending !== null || userLockPending !== null}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {userDeletePending === user.id ? t("Deleting...") : t("Delete")}
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-stone-500">
                  <span>
                    {t("Page {page} of {total}", {
                      page: usersPage + 1,
                      total: totalUsersPages
                    })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUsersPage((prev) => Math.max(0, prev - 1))}
                      disabled={usersPage === 0}
                    >
                      {t("Previous")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUsersPage((prev) => Math.min(totalUsersPages - 1, prev + 1))}
                      disabled={usersPage >= totalUsersPages - 1}
                    >
                      {t("Next")}
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
                  {t("Item moderation")}
                </p>
                <h2 className="font-display mt-3 text-2xl text-stone-900">
                  {t("Review the latest items across all collections and remove entries when needed.")}
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600">
                <Package className="h-3.5 w-3.5" />
                {t("Total items")}: {totalItems}
              </span>
            </div>

            {itemsError ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {t(itemsError)}
              </div>
            ) : null}

            {itemsStatus === "loading" ? (
              <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("Loading items...")}
              </div>
            ) : items.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                {t("No items available yet.")}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-white/80 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{item.name}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {t("Collection #{id}", { id: item.collection_id })}: {item.collection_name}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {t("Owner: {email}", { email: item.owner_email })}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-600">
                        <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1">
                          {t("Images: {count}", { count: item.image_count })}
                        </span>
                        {item.is_featured ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                            {t("Featured")}
                          </span>
                        ) : null}
                        {item.is_highlight ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                            {t("Spotlight")}
                          </span>
                        ) : null}
                      </div>
                      {item.notes ? (
                        <p className="mt-2 line-clamp-2 text-xs text-stone-500">{item.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(item.created_at, locale)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={() => handleDeleteItem(item)}
                        disabled={itemDeletePending !== null}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {itemDeletePending === item.id ? t("Deleting...") : t("Delete")}
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-stone-500">
                  <span>
                    {t("Page {page} of {total}", {
                      page: itemsPage + 1,
                      total: totalItemsPages
                    })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setItemsPage((prev) => Math.max(0, prev - 1))}
                      disabled={itemsPage === 0}
                    >
                      {t("Previous")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setItemsPage((prev) => Math.min(totalItemsPages - 1, prev + 1))}
                      disabled={itemsPage >= totalItemsPages - 1}
                    >
                      {t("Next")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

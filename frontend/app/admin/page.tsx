"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
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

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  adminApi,
  getAdminToken,
  isApiError,
  type AdminItemResponse,
  type AdminUserResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";
import { Card, EmptyState } from "@/components/ui/card";

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
  const confirm = useConfirm();
  const [isReady, setIsReady] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginError, setLoginError] = React.useState<string | null>(null);

  const queryClient = useQueryClient();

  const [collectionsPage, setCollectionsPage] = React.useState(0);
  const [usersPage, setUsersPage] = React.useState(0);
  const [usersActionError, setUsersActionError] = React.useState<string | null>(null);
  const [usersSearchInput, setUsersSearchInput] = React.useState("");
  const [usersSearchQuery, setUsersSearchQuery] = React.useState("");

  const [itemsPage, setItemsPage] = React.useState(0);
  const [itemsActionError, setItemsActionError] = React.useState<string | null>(null);
  const [itemsSearchInput, setItemsSearchInput] = React.useState("");
  const [itemsSearchQuery, setItemsSearchQuery] = React.useState("");

  const [featuredItemSelection, setFeaturedItemSelection] = React.useState<number[]>([]);
  const [featuredItemsMessage, setFeaturedItemsMessage] = React.useState<string | null>(null);
  const [featuredItemsError, setFeaturedItemsError] = React.useState<string | null>(null);
  const [featuredItemsPending, setFeaturedItemsPending] = React.useState(false);

  const [actionErrorMessage, setActionErrorMessage] = React.useState<string | null>(null);
  const [featurePending, setFeaturePending] = React.useState<number | null>(null);
  const [userLockPending, setUserLockPending] = React.useState<number | null>(null);
  const [userDeletePending, setUserDeletePending] = React.useState<number | null>(null);
  const [itemDeletePending, setItemDeletePending] = React.useState<number | null>(null);

  // Every admin table is a keyed query: page and search term are part of the
  // key, so switching pages or searching cancels the previous request instead
  // of racing it.
  const statsQuery = useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: ({ signal }) => adminApi.stats({ signal }),
    enabled: isAuthenticated
  });
  const collectionsQuery = useQuery({
    queryKey: queryKeys.admin.collections(collectionsPage),
    queryFn: ({ signal }) =>
      adminApi.collections({
        offset: collectionsPage * PAGE_SIZE,
        limit: PAGE_SIZE,
        signal
      }),
    enabled: isAuthenticated
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users(usersPage, usersSearchQuery.trim()),
    queryFn: ({ signal }) =>
      adminApi.users({
        offset: usersPage * PAGE_SIZE,
        limit: PAGE_SIZE,
        q: usersSearchQuery.trim() || undefined,
        signal
      }),
    enabled: isAuthenticated
  });
  const itemsQuery = useQuery({
    queryKey: queryKeys.admin.items(itemsPage, itemsSearchQuery.trim()),
    queryFn: ({ signal }) =>
      adminApi.items({
        offset: itemsPage * PAGE_SIZE,
        limit: PAGE_SIZE,
        q: itemsSearchQuery.trim() || undefined,
        signal
      }),
    enabled: isAuthenticated
  });

  const stats = statsQuery.data ?? null;
  const featuredCollectionId = stats?.featured_collection_id ?? null;

  const featuredItemsQuery = useQuery({
    queryKey: queryKeys.admin.featuredItems(),
    queryFn: ({ signal }) => adminApi.featuredItems({ signal }),
    enabled: isAuthenticated && Boolean(featuredCollectionId)
  });

  const collections = collectionsQuery.data?.items ?? [];
  const totalCollections = collectionsQuery.data?.total_count ?? 0;
  const users = usersQuery.data?.items ?? [];
  const totalUsers = usersQuery.data?.total_count ?? 0;
  const items = itemsQuery.data?.items ?? [];
  const totalItems = itemsQuery.data?.total_count ?? 0;

  const collectionsStatus: "idle" | "loading" | "error" =
    statsQuery.isError || collectionsQuery.isError
      ? "error"
      : statsQuery.isFetching || collectionsQuery.isFetching
        ? "loading"
        : "idle";
  const usersStatus: "idle" | "loading" | "error" = usersQuery.isError
    ? "error"
    : usersQuery.isFetching
      ? "loading"
      : "idle";
  const itemsStatus: "idle" | "loading" | "error" = itemsQuery.isError
    ? "error"
    : itemsQuery.isFetching
      ? "loading"
      : "idle";

  const featuredItemsState = {
    status: (!featuredCollectionId
      ? "ready"
      : featuredItemsQuery.isError
        ? "error"
        : featuredItemsQuery.isPending
          ? "loading"
          : "ready") as "idle" | "loading" | "ready" | "error",
    data: featuredCollectionId ? (featuredItemsQuery.data ?? []) : [],
    error: featuredItemsQuery.isError
      ? isApiError(featuredItemsQuery.error)
        ? featuredItemsQuery.error.detail
        : "Unable to load featured items."
      : undefined
  };

  // Query failures surface in the same banners the manual loaders used.
  const loadFailure = statsQuery.error ?? collectionsQuery.error;
  const collectionsErrorMessage = loadFailure
    ? isApiError(loadFailure)
      ? loadFailure.detail
      : "We couldn't load admin data."
    : null;
  const usersLoadError = usersQuery.isError
    ? isApiError(usersQuery.error)
      ? usersQuery.error.detail
      : "Unable to load users."
    : null;
  const itemsLoadError = itemsQuery.isError
    ? isApiError(itemsQuery.error)
      ? itemsQuery.error.detail
      : "Unable to load items."
    : null;

  // Reset the checkbox selection whenever the server list changes.
  const featuredItemsData = featuredItemsQuery.data;
  React.useEffect(() => {
    if (featuredItemsData) {
      setFeaturedItemSelection(
        featuredItemsData.filter((item) => item.is_featured).map((item) => item.id)
      );
    }
  }, [featuredItemsData]);

  // A failed action takes precedence over a stale load error in the banner.
  const errorMessage = actionErrorMessage ?? collectionsErrorMessage;
  const usersError = usersActionError ?? usersLoadError;
  const itemsError = itemsActionError ?? itemsLoadError;

  const refreshAdminData = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
    [queryClient]
  );

  React.useEffect(() => {
    setIsAuthenticated(Boolean(getAdminToken()));
    setIsReady(true);
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    try {
      await adminApi.login({ email, password });
      setIsAuthenticated(true);
      setCollectionsPage(0);
      setUsersPage(0);
      setItemsPage(0);
      void refreshAdminData();
    } catch (error) {
      setLoginError(
        isApiError(error) ? error.detail : "Unable to sign in to the admin console."
      );
    }
  };

  const handleLogout = () => {
    adminApi.logout();
    setIsAuthenticated(false);
    // Drop every cached admin response so the next sign-in starts clean.
    queryClient.removeQueries({ queryKey: queryKeys.admin.all });
    setFeaturedItemSelection([]);
    setFeaturedItemsMessage(null);
    setFeaturedItemsError(null);
    setActionErrorMessage(null);
    setUsersActionError(null);
    setItemsActionError(null);
    setUsersSearchInput("");
    setUsersSearchQuery("");
    setItemsSearchInput("");
    setItemsSearchQuery("");
  };

  const handleRefreshAll = () => {
    setActionErrorMessage(null);
    setUsersActionError(null);
    setItemsActionError(null);
    void refreshAdminData();
  };

  const handleFeature = async (collectionId: number | null) => {
    setFeaturePending(collectionId ?? -1);
    setActionErrorMessage(null);
    try {
      // The write publishes a mutation, which invalidates every admin query.
      await adminApi.feature(collectionId);
    } catch (error) {
      setActionErrorMessage(
        isApiError(error) ? error.detail : "Unable to update featured collection."
      );
    } finally {
      setFeaturePending(null);
    }
  };

  const handleToggleUserLock = async (user: AdminUserResponse) => {
    setUserLockPending(user.id);
    setUsersActionError(null);
    try {
      await adminApi.setUserLocked(user.id, user.is_active);
    } catch (error) {
      setUsersActionError(
        isApiError(error) ? error.detail : "Unable to update user lock status."
      );
    } finally {
      setUserLockPending(null);
    }
  };

  const handleDeleteUser = async (user: AdminUserResponse) => {
    const confirmed = await confirm({
      title: t('Delete user "{email}"? This permanently removes their collections and items.', {
        email: user.email
      }),
      confirmLabel: t("Delete"),
      tone: "destructive"
    });
    if (!confirmed) {
      return;
    }
    setUserDeletePending(user.id);
    setUsersActionError(null);
    try {
      await adminApi.deleteUser(user.id);
    } catch (error) {
      setUsersActionError(isApiError(error) ? error.detail : "Unable to delete user.");
    } finally {
      setUserDeletePending(null);
    }
  };

  const handleDeleteItem = async (item: AdminItemResponse) => {
    const confirmed = await confirm({
      title: t('Delete item "{name}"? This cannot be undone.', { name: item.name }),
      confirmLabel: t("Delete"),
      tone: "destructive"
    });
    if (!confirmed) {
      return;
    }
    setItemDeletePending(item.id);
    setItemsActionError(null);
    try {
      await adminApi.deleteItem(item.id);
    } catch (error) {
      setItemsActionError(isApiError(error) ? error.detail : "Unable to delete item.");
    } finally {
      setItemDeletePending(null);
    }
  };

  const selectionCount = featuredItemSelection.length;
  const selectionFull = selectionCount >= MAX_FEATURED_ITEMS;

  const toggleFeaturedItem = async (itemId: number) => {
    if (!stats?.featured_collection_id || featuredItemsPending) {
      return;
    }
    const previousSelection = featuredItemSelection;
    const nextSelection = previousSelection.includes(itemId)
      ? previousSelection.filter((id) => id !== itemId)
      : previousSelection.length >= MAX_FEATURED_ITEMS
        ? previousSelection
        : [...previousSelection, itemId];

    if (nextSelection === previousSelection) {
      return;
    }

    setFeaturedItemsPending(true);
    setFeaturedItemsMessage(null);
    setFeaturedItemsError(null);
    setFeaturedItemSelection(nextSelection);
    try {
      await adminApi.setFeaturedItems(nextSelection);
      setFeaturedItemsMessage("Featured items updated.");
    } catch (error) {
      setFeaturedItemSelection(previousSelection);
      setFeaturedItemsError(
        isApiError(error) ? error.detail : "Unable to update featured items."
      );
    } finally {
      setFeaturedItemsPending(false);
    }
  };

  const handleUsersSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setUsersPage(0);
    setUsersSearchQuery(usersSearchInput.trim());
  };

  const handleClearUsersSearch = () => {
    setUsersSearchInput("");
    setUsersSearchQuery("");
    setUsersPage(0);
  };

  const handleItemsSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setItemsPage(0);
    setItemsSearchQuery(itemsSearchInput.trim());
  };

  const handleClearItemsSearch = () => {
    setItemsSearchInput("");
    setItemsSearchQuery("");
    setItemsPage(0);
  };

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("Loading admin console...")}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background px-6 py-12">
        <Card padding="lg" className="mx-auto w-full max-w-md">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Antique Catalogue"
              width={44}
              height={44}
              className="rounded-full"
            />
            <div>
              <p className="font-display text-lg tracking-tight">{t("Admin Console")}</p>
              <Eyebrow className="tracking-[0.35em]">
                {t("Antique Catalogue")}
              </Eyebrow>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-strong">
            {t("Sign in with your admin credentials to manage users, collections, and featured content.")}
          </p>

          {loginError ? (
            <Alert className="px-3 py-2 mt-4 text-xs">
              {t(loginError)}
            </Alert>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="text-xs font-medium text-muted-strong" htmlFor="admin-email">
                {t("Email")}
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-brand-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-strong" htmlFor="admin-password">
                {t("Password")}
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-brand-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" className="w-full">
              {t("Sign in")}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  const totalCollectionPages = Math.max(1, Math.ceil(totalCollections / PAGE_SIZE));
  const totalUsersPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const totalItemsPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-background px-6 py-10 lg:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-4">
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
                <Eyebrow className="tracking-[0.35em]">
                  {t("Studio Archive")}
                </Eyebrow>
              </div>
            </Link>
            <div className="hidden h-11 border-l border-border lg:block" />
            <div>
              <Eyebrow tone="brand" spacing="wide">{t("Admin")}</Eyebrow>
              <SectionHeading as="h1" size="xl" className="mt-3">
                {t("Catalogue administration")}
              </SectionHeading>
              <p className="mt-2 text-sm text-muted-strong">
                {t("Monitor platform activity, moderate users, and curate featured content.")}
              </p>
            </div>
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
          <Alert>
            {t(errorMessage)}
          </Alert>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm">
            <Eyebrow tone="subtle">{t("Total users")}</Eyebrow>
            <p className="mt-4 text-3xl font-semibold text-foreground">{stats?.total_users ?? "-"}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("Registered accounts")}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm">
            <Eyebrow tone="subtle">
              {t("Total collections")}
            </Eyebrow>
            <p className="mt-4 text-3xl font-semibold text-foreground">
              {stats?.total_collections ?? "-"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("Across all users")}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm">
            <Eyebrow tone="subtle">
              {t("Featured collection")}
            </Eyebrow>
            <p className="mt-4 text-3xl font-semibold text-foreground">
              {stats?.featured_collection_id ?? "-"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("Current featured ID")}</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <section className="rounded-3xl border border-border bg-card/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Eyebrow>
                  {t("Featured selection")}
                </Eyebrow>
                <SectionHeading className="mt-3">
                  {t("Choose a public collection to highlight.")}
                </SectionHeading>
                <p className="mt-2 text-sm text-muted-strong">
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
              <EmptyState size="sm" className="mt-6">
                {t("Loading collections...")}
              </EmptyState>
            ) : collections.length === 0 ? (
              <EmptyState size="sm" className="mt-6">
                {t("No collections available yet.")}
              </EmptyState>
            ) : (
              <div className="mt-6 space-y-4">
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="rounded-2xl border border-border bg-card/80 p-4"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                      <div className="min-w-0">
                        <Eyebrow tone="subtle">
                          {t("Collection #{id}", { id: collection.id })}
                        </Eyebrow>
                        <h3 className="mt-2 text-lg font-semibold text-foreground">
                          {collection.name}
                        </h3>
                        <p className="mt-2 text-sm text-muted-strong">
                          {collection.description ?? t("No description provided.")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1">
                            {t("Owner: {email}", {
                              email: collection.owner_email
                            })}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1">
                            {collection.is_public ? t("Public") : t("Private")}
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(collection.created_at, locale)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {collection.is_featured ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-muted px-3 py-1 text-xs font-medium text-brand">
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

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
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

          <section className="rounded-3xl border border-border bg-card/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Eyebrow>
                  {t("Featured items")}
                </Eyebrow>
                <SectionHeading className="mt-3">
                  {t("Curate highlights from the featured collection.")}
                </SectionHeading>
                <p className="mt-2 text-sm text-muted-strong">
                  {t("Select up to {count} items to spotlight on the homepage.", {
                    count: MAX_FEATURED_ITEMS
                  })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {t("{selected} of {count} selected", {
                    selected: selectionCount,
                    count: MAX_FEATURED_ITEMS
                  })}
                </span>
                {featuredItemsPending ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1">
                    {t("Saving...")}
                  </span>
                ) : null}
              </div>
            </div>

            {featuredItemsMessage ? (
              <Alert tone="success" className="mt-6">
                {t(featuredItemsMessage)}
              </Alert>
            ) : null}

            {featuredItemsError ? (
              <Alert className="mt-6">
                {t(featuredItemsError)}
              </Alert>
            ) : null}

            {!stats?.featured_collection_id ? (
              <EmptyState size="sm" className="mt-6">
                {t("Choose a featured collection to manage highlighted items.")}
              </EmptyState>
            ) : featuredItemsState.status === "loading" ? (
              <EmptyState size="sm" className="mt-6">
                {t("Loading featured items...")}
              </EmptyState>
            ) : featuredItemsState.status === "error" ? (
              <Alert className="mt-6">
                {t(featuredItemsState.error ?? "Unable to load featured items.")}
              </Alert>
            ) : featuredItemsState.data.length === 0 ? (
              <EmptyState size="sm" className="mt-6">
                {t("No items yet in this collection.")}
              </EmptyState>
            ) : (
              <div className="mt-6 space-y-3">
                {featuredItemsState.data.map((item) => {
                  const isSelected = featuredItemSelection.includes(item.id);
                  const disableSelect = !isSelected && selectionFull;
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl border border-border bg-card/80 p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("Added {date}", {
                            date: formatDate(item.created_at, locale)
                          })}
                        </p>
                        {item.notes ? (
                          <p className="mt-2 text-xs text-muted-foreground">{item.notes}</p>
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
          <section className="rounded-3xl border border-border bg-card/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Eyebrow>
                  {t("User management")}
                </Eyebrow>
                <SectionHeading className="mt-3">
                  {t("Review users, lock access, or remove accounts and their catalogue data.")}
                </SectionHeading>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-strong">
                <Users className="h-3.5 w-3.5" />
                {t("Total users")}: {totalUsers}
              </span>
            </div>

            <form className="mt-6 flex flex-wrap items-center gap-2" onSubmit={handleUsersSearch}>
              <input
                value={usersSearchInput}
                onChange={(event) => setUsersSearchInput(event.target.value)}
                placeholder={t("Search users by email or username")}
                className="h-9 min-w-[220px] flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-sm transition focus:border-brand-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="submit" size="sm" variant="outline" disabled={usersStatus === "loading"}>
                {t("Search")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClearUsersSearch}
                disabled={
                  usersStatus === "loading" || (!usersSearchInput && !usersSearchQuery)
                }
              >
                {t("Clear")}
              </Button>
            </form>

            {usersSearchQuery ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {t('Showing results for "{query}"', { query: usersSearchQuery })}
              </p>
            ) : null}

            {usersError ? (
              <Alert className="mt-6">
                {t(usersError)}
              </Alert>
            ) : null}

            {usersStatus === "loading" ? (
              <EmptyState size="sm" className="mt-6">
                {t("Loading users...")}
              </EmptyState>
            ) : users.length === 0 ? (
              <EmptyState size="sm" className="mt-6">
                {usersSearchQuery ? t("No users match this search.") : t("No users available yet.")}
              </EmptyState>
            ) : (
              <div className="mt-6 space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card/80 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{user.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("Username")}: {user.username}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 ${
                            user.is_active
                              ? "border-success-border bg-success-muted text-success"
                              : "border-destructive-border bg-destructive-muted text-destructive"
                          }`}
                        >
                          {user.is_active ? t("Active") : t("Locked")}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-muted-strong">
                          {user.is_verified ? t("Verified") : t("Unverified")}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-muted-strong">
                          {t("Collections: {count}", { count: user.collection_count })}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-muted-strong">
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
                        className="border-destructive-border text-destructive hover:bg-destructive-muted"
                        onClick={() => handleDeleteUser(user)}
                        disabled={userDeletePending !== null || userLockPending !== null}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {userDeletePending === user.id ? t("Deleting...") : t("Delete")}
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
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

          <section className="rounded-3xl border border-border bg-card/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Eyebrow>
                  {t("Item moderation")}
                </Eyebrow>
                <SectionHeading className="mt-3">
                  {t("Review the latest items across all collections and remove entries when needed.")}
                </SectionHeading>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-strong">
                <Package className="h-3.5 w-3.5" />
                {t("Total items")}: {totalItems}
              </span>
            </div>

            <form className="mt-6 flex flex-wrap items-center gap-2" onSubmit={handleItemsSearch}>
              <input
                value={itemsSearchInput}
                onChange={(event) => setItemsSearchInput(event.target.value)}
                placeholder={t("Search items by name, notes, collection, or owner")}
                className="h-9 min-w-[220px] flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-sm transition focus:border-brand-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="submit" size="sm" variant="outline" disabled={itemsStatus === "loading"}>
                {t("Search")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClearItemsSearch}
                disabled={
                  itemsStatus === "loading" || (!itemsSearchInput && !itemsSearchQuery)
                }
              >
                {t("Clear")}
              </Button>
            </form>

            {itemsSearchQuery ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {t('Showing results for "{query}"', { query: itemsSearchQuery })}
              </p>
            ) : null}

            {itemsError ? (
              <Alert className="mt-6">
                {t(itemsError)}
              </Alert>
            ) : null}

            {itemsStatus === "loading" ? (
              <EmptyState size="sm" className="mt-6">
                {t("Loading items...")}
              </EmptyState>
            ) : items.length === 0 ? (
              <EmptyState size="sm" className="mt-6">
                {itemsSearchQuery ? t("No items match this search.") : t("No items available yet.")}
              </EmptyState>
            ) : (
              <div className="mt-6 space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card/80 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("Collection #{id}", { id: item.collection_id })}: {item.collection_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("Owner: {email}", { email: item.owner_email })}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-strong">
                        <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1">
                          {t("Images: {count}", { count: item.image_count })}
                        </span>
                        {item.is_featured ? (
                          <span className="inline-flex items-center rounded-full border border-brand-border bg-brand-muted px-2.5 py-1 text-brand">
                            {t("Featured")}
                          </span>
                        ) : null}
                        {item.is_highlight ? (
                          <span className="inline-flex items-center rounded-full border border-brand-border bg-brand-muted px-2.5 py-1 text-brand">
                            {t("Spotlight")}
                          </span>
                        ) : null}
                      </div>
                      {item.notes ? (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-strong">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(item.created_at, locale)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive-border text-destructive hover:bg-destructive-muted"
                        onClick={() => handleDeleteItem(item)}
                        disabled={itemDeletePending !== null}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {itemDeletePending === item.id ? t("Deleting...") : t("Delete")}
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
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

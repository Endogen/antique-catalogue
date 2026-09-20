"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Globe2,
  Image as ImageIcon,
  LogOut,
  RefreshCcw,
  Star
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Lightbox } from "@/components/lightbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { SocialShareActions } from "@/components/social-share-actions";
import {
  imageApi,
  isApiError,
  publicCollectionApi,
  publicItemApi,
  starsApi,
  type CollectionResponse,
  type ItemImageResponse,
  type ItemResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { formatMetadataNumber } from "@/lib/format";
import { Card, EmptyState } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

export default function PublicItemDetailPage() {
  const params = useParams();
  const { isAuthenticated, logout, status: authStatus } = useAuth();
  const { t, tc, locale } = useI18n();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const itemIdParam = Array.isArray(params?.itemId) ? params.itemId[0] : params?.itemId;
  const itemId = itemIdParam ? Number(itemIdParam) : NaN;

  const queryClient = useQueryClient();
  const hasIds = Boolean(collectionId) && Number.isFinite(itemId);

  const collectionQuery = useQuery({
    queryKey: queryKeys.explore.collection(Number(collectionId)),
    queryFn: ({ signal }) => publicCollectionApi.get(collectionId!, { signal }),
    enabled: Boolean(collectionId)
  });
  const itemQuery = useQuery({
    queryKey: queryKeys.explore.item(Number(collectionId), itemId),
    queryFn: ({ signal }) =>
      publicItemApi.get(collectionId!, itemIdParam!, { signal }),
    enabled: hasIds
  });
  const imagesQuery = useQuery({
    queryKey: queryKeys.items.images(itemId),
    queryFn: ({ signal }) => imageApi.list(itemId, { signal }),
    enabled: Number.isFinite(itemId)
  });

  const collectionState = toLoadState<CollectionResponse | undefined>(
    collectionQuery,
    "We couldn't load this collection.",
    undefined
  );
  const itemState = toLoadState<ItemResponse | undefined>(
    itemQuery,
    "We couldn't load this item.",
    undefined
  );
  const imagesState = toLoadState<ItemImageResponse[]>(
    imagesQuery,
    "We couldn't load item images.",
    []
  );
  const [selectedImageId, setSelectedImageId] = React.useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [itemStarred, setItemStarred] = React.useState(false);
  const [isUpdatingItemStar, setIsUpdatingItemStar] = React.useState(false);
  const [itemStarError, setItemStarError] = React.useState<string | null>(null);

  const showAuthenticatedCtas =
    authStatus === "authenticated" && isAuthenticated;

  const formatDate = React.useCallback(
    (value?: string | null) => {
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

  const formatMetadataValue = React.useCallback(
    (value: unknown) => {
      if (value === null || value === undefined) {
        return "-";
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "number") {
        return formatMetadataNumber(locale, value);
      }
      if (typeof value === "boolean") {
        return value ? t("Yes") : t("No");
      }
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      if (typeof value === "object") {
        return t("Details");
      }
      return String(value);
    },
    [locale, t]
  );

  const applyItemStarCount = React.useCallback(
    (starCount: number) => {
      queryClient.setQueryData<ItemResponse | undefined>(
        queryKeys.explore.item(Number(collectionId), itemId),
        (previous) =>
          previous ? { ...previous, star_count: starCount } : previous
      );
    },
    [queryClient, collectionId, itemId]
  );

  const { refetch: refetchCollection } = collectionQuery;
  const { refetch: refetchItem } = itemQuery;
  const { refetch: refetchImages } = imagesQuery;
  const loadCollection = React.useCallback(() => {
    void refetchCollection();
  }, [refetchCollection]);
  const loadItem = React.useCallback(() => {
    void refetchItem();
  }, [refetchItem]);
  const loadImages = React.useCallback(() => {
    void refetchImages();
  }, [refetchImages]);


  React.useEffect(() => {
    if (imagesState.status !== "ready") {
      return;
    }
    const images = imagesState.data ?? [];
    if (!images.length) {
      setSelectedImageId(null);
      return;
    }
    if (!images.find((image) => image.id === selectedImageId)) {
      setSelectedImageId(images[0].id);
    }
  }, [imagesState.data, imagesState.status, selectedImageId]);

  const loadItemStarStatus = React.useCallback(async () => {
    if (!collectionId || !itemIdParam || !showAuthenticatedCtas) {
      setItemStarred(false);
      return;
    }
    try {
      const status = await starsApi.itemStatus(collectionId, itemIdParam);
      setItemStarred(status.starred);
      applyItemStarCount(status.star_count);
    } catch (error) {
      if (!isApiError(error) || error.status !== 404) {
        setItemStarError(
          isApiError(error) ? error.detail : "We couldn't update star status."
        );
      }
    }
  }, [applyItemStarCount, collectionId, itemIdParam, showAuthenticatedCtas]);

  React.useEffect(() => {
    void loadItemStarStatus();
  }, [loadItemStarStatus]);

  const handleRefresh = () => {
    setItemStarError(null);
    void loadCollection();
    void loadItem();
    void loadImages();
    void loadItemStarStatus();
  };

  const handleToggleItemStar = async () => {
    if (!collectionId || !itemIdParam || !showAuthenticatedCtas || isUpdatingItemStar) {
      return;
    }
    setItemStarError(null);
    setIsUpdatingItemStar(true);
    try {
      const status = itemStarred
        ? await starsApi.unstarItem(collectionId, itemIdParam)
        : await starsApi.starItem(collectionId, itemIdParam);
      setItemStarred(status.starred);
      applyItemStarCount(status.star_count);
    } catch (error) {
      setItemStarError(
        isApiError(error) ? error.detail : "We couldn't update stars."
      );
    } finally {
      setIsUpdatingItemStar(false);
    }
  };

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

  const metadataEntries = React.useMemo(
    () => Object.entries(itemState.data?.metadata ?? {}),
    [itemState.data?.metadata]
  );

  const selectedImage = React.useMemo(
    () => imagesState.data?.find((image) => image.id === selectedImageId) ?? null,
    [imagesState.data, selectedImageId]
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-amber-300/20 blur-[100px]" />
      <div className="pointer-events-none absolute top-[35%] left-[-8%] h-72 w-72 rounded-full bg-amber-200/25 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-8%] h-80 w-80 rounded-full bg-panel/10 blur-[160px]" />
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
                <Eyebrow className="tracking-[0.35em]">
                  {t("Studio Archive")}
                </Eyebrow>
              </div>
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-muted-strong md:flex">
              <Link href="/" className="hover:text-foreground">
                {t("Home")}
              </Link>
              <Link href="/explore" className="font-medium text-foreground">
                {t("Explore")}
              </Link>
              <Link href="/dashboard" className="hover:text-foreground">
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
                  <Button variant="ghost" className="hidden sm:inline-flex" asChild>
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
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-10 pt-6 lg:px-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/explore/${collectionId ?? ""}`}>
                  <ArrowLeft className="h-4 w-4" />
                  {t("Back to collection")}
                </Link>
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {showAuthenticatedCtas ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleItemStar}
                    disabled={isUpdatingItemStar}
                  >
                    <Star className={`h-4 w-4 text-brand ${itemStarred ? "fill-current" : ""}`} />
                    {itemState.data?.star_count ?? 0}
                  </Button>
                ) : (
                  <span className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium">
                    <Star className="h-4 w-4 text-brand" />
                    {itemState.data?.star_count ?? 0}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-9 px-0"
                  onClick={handleRefresh}
                  aria-label={t("Refresh")}
                  title={t("Refresh")}
                >
                  <RefreshCcw className="h-4 w-4" />
                </Button>
                <SocialShareActions
                  path={
                    collectionId && itemIdParam
                      ? `/explore/${collectionId}/items/${itemIdParam}`
                      : null
                  }
                  title={
                    itemState.status === "ready" && itemState.data
                      ? itemState.data.name
                      : t("Item detail")
                  }
                  text={
                    itemState.status === "ready" && itemState.data
                      ? itemState.data.notes
                      : undefined
                  }
                  iconOnly
                  copyFirst
                />
              </div>
            </div>
            {itemStarError ? (
              <p className="text-sm text-destructive">{t(itemStarError)}</p>
            ) : null}

            {itemState.status === "loading" ? (
              <EmptyState
                aria-busy="true">
                {t("Loading item details...")}
              </EmptyState>
            ) : itemState.status === "error" ? (
              <Alert className="rounded-3xl p-6">
                <p className="text-sm font-medium text-destructive">
                  {t("We hit a snag loading this item.")}
                </p>
                <p className="mt-2 text-sm text-destructive">
                  {t(itemState.error ?? "Please try again.")}
                </p>
                <div className="mt-4">
                  <Button variant="outline" onClick={handleRefresh}>
                    {t("Try again")}
                  </Button>
                </div>
              </Alert>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <Card>
                  <Eyebrow tone="brand" spacing="wide">
                    {t("Item detail")}
                  </Eyebrow>
                  <SectionHeading as="h1" size="xl" className="mt-4">
                    {itemState.data?.name}
                  </SectionHeading>
                  <p className="mt-3 text-sm text-muted-strong">
                    {itemState.data?.notes?.trim()
                      ? itemState.data.notes
                      : t("No description provided.")}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3 text-xs">
                    <span className="inline-flex items-center gap-2 rounded-full border border-success-border bg-success-muted px-3 py-1 font-medium text-success">
                      <Globe2 className="h-3.5 w-3.5" />
                      {t("Public item")}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 font-medium text-muted-strong">
                      <ImageIcon className="h-3.5 w-3.5 text-brand" />
                      {tc(imagesState.data?.length ?? 0, "{count} image", "{count} images")}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 font-medium text-muted-strong">
                      <Star className="h-3.5 w-3.5 text-brand" />
                      {tc(itemState.data?.star_count ?? 0, "{count} star", "{count} stars")}
                    </span>
                  </div>
                </Card>

                <Card tone="subtle">
                  <Eyebrow>
                    {t("Item snapshot")}
                  </Eyebrow>
                  <div className="mt-6 space-y-4 text-sm text-muted-strong">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{t("Created")}</p>
                        <p>{formatDate(itemState.data?.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                        <RefreshCcw className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{t("Updated")}</p>
                        <p>{formatDate(itemState.data?.updated_at)}</p>
                      </div>
                    </div>
                    {collectionState.status === "ready" && collectionState.data ? (
                      <div className="rounded-2xl border border-border bg-card/90 p-3">
                        <Eyebrow tone="subtle" spacing="tight">
                          {t("Collection")}
                        </Eyebrow>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {collectionState.data.name}
                        </p>
                        {collectionState.data.owner_username ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("By")}{" "}
                            <Link
                              href={`/profile/${encodeURIComponent(collectionState.data.owner_username)}`}
                              className="font-medium text-brand hover:text-brand-strong"
                            >
                              @{collectionState.data.owner_username}
                            </Link>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </section>

        {itemState.status === "ready" ? (
          <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card>
                <Eyebrow>
                  {t("Images")}
                </Eyebrow>
                <SectionHeading className="mt-3">
                  {t("Gallery")}
                </SectionHeading>
                <p className="mt-3 text-sm text-muted-strong">
                  {t("Click any image to view it in detail.")}
                </p>

                {imagesState.status === "loading" ? (
                  <EmptyState size="sm" className="mt-6">
                    {t("Loading images...")}
                  </EmptyState>
                ) : imagesState.status === "error" ? (
                  <Alert className="p-6 mt-6">
                    {t(imagesState.error ?? "We couldn't load item images.")}
                  </Alert>
                ) : !imagesState.data?.length ? (
                  <div className="mt-6 rounded-2xl border border-border bg-background p-10 text-center text-sm text-muted-foreground">
                    {t("No images uploaded for this item yet.")}
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {selectedImage ? (
                      <button
                        type="button"
                        className="block w-full overflow-hidden rounded-2xl border border-border bg-background"
                        onClick={() => setLightboxOpen(true)}
                      >
                        <Image
                          src={imageApi.url(selectedImage.id, "medium")}
                          alt={itemState.data?.name ?? t("Item image")}
                          width={1200}
                          height={720}
                          className="block h-[360px] w-full object-cover"
                          unoptimized
                        />
                      </button>
                    ) : null}
                    <div className="grid grid-cols-4 gap-3">
                      {imagesState.data.map((image) => (
                        <button
                          key={image.id}
                          type="button"
                          className={`overflow-hidden rounded-xl border bg-background ${
                            image.id === selectedImageId
                              ? "border-brand ring-2 ring-ring/70"
                              : "border-border"
                          }`}
                          onClick={() => setSelectedImageId(image.id)}
                        >
                          <Image
                            src={imageApi.url(image.id, "thumb")}
                            alt={itemState.data?.name ?? t("Item image")}
                            width={320}
                            height={80}
                            className="block h-20 w-full object-cover"
                            unoptimized
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <Card>
                <Eyebrow>
                  {t("Metadata")}
                </Eyebrow>
                <SectionHeading className="mt-3">
                  {t("Shared attributes")}
                </SectionHeading>
                <p className="mt-3 text-sm text-muted-strong">
                  {t("Complete data available for this public item.")}
                </p>

                {metadataEntries.length === 0 ? (
                  <EmptyState size="sm" className="mt-6">
                    {t("No metadata shared.")}
                  </EmptyState>
                ) : (
                  <div className="mt-6 space-y-3">
                    {metadataEntries.map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-2xl border border-border bg-background p-3"
                      >
                        <Eyebrow tone="subtle" spacing="tight">
                          {key}
                        </Eyebrow>
                        <p className="mt-1 text-sm text-muted-strong">
                          {formatMetadataValue(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </section>
        ) : null}
      </div>

      <Lightbox
        open={lightboxOpen}
        src={selectedImage ? imageApi.url(selectedImage.id, "large") : null}
        alt={itemState.data?.name}
        onClose={() => setLightboxOpen(false)}
      />
    </main>
  );
}

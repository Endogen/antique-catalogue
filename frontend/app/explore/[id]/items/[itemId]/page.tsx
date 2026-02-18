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

type LoadState<T> = {
  status: "loading" | "ready" | "error";
  data?: T;
  error?: string;
};

export default function PublicItemDetailPage() {
  const params = useParams();
  const { isAuthenticated, logout, status: authStatus } = useAuth();
  const { t, locale } = useI18n();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const itemIdParam = Array.isArray(params?.itemId) ? params.itemId[0] : params?.itemId;
  const itemId = itemIdParam ? Number(itemIdParam) : NaN;

  const [collectionState, setCollectionState] = React.useState<LoadState<CollectionResponse>>({
    status: "loading"
  });
  const [itemState, setItemState] = React.useState<LoadState<ItemResponse>>({
    status: "loading"
  });
  const [imagesState, setImagesState] = React.useState<LoadState<ItemImageResponse[]>>({
    status: "loading",
    data: []
  });
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
        return new Intl.NumberFormat(locale).format(value);
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

  const loadCollection = React.useCallback(async () => {
    if (!collectionId) {
      setCollectionState({
        status: "error",
        error: "Collection ID was not provided."
      });
      return;
    }
    setCollectionState({ status: "loading" });
    try {
      const data = await publicCollectionApi.get(collectionId);
      setCollectionState({
        status: "ready",
        data
      });
    } catch (error) {
      setCollectionState({
        status: "error",
        error: isApiError(error)
          ? error.detail
          : "We couldn't load this collection."
      });
    }
  }, [collectionId]);

  const loadItem = React.useCallback(async () => {
    if (!collectionId || !itemIdParam) {
      setItemState({
        status: "error",
        error: "Item ID was not provided."
      });
      return;
    }
    setItemState({ status: "loading" });
    try {
      const data = await publicItemApi.get(collectionId, itemIdParam);
      setItemState({
        status: "ready",
        data
      });
    } catch (error) {
      setItemState({
        status: "error",
        error: isApiError(error) ? error.detail : "We couldn't load this item."
      });
    }
  }, [collectionId, itemIdParam]);

  const loadImages = React.useCallback(async () => {
    if (!Number.isFinite(itemId)) {
      setImagesState({
        status: "error",
        data: [],
        error: "Item ID was not provided."
      });
      return;
    }
    setImagesState({ status: "loading", data: [] });
    try {
      const data = await imageApi.list(itemId);
      setImagesState({
        status: "ready",
        data
      });
      setSelectedImageId((prev) => prev ?? data[0]?.id ?? null);
    } catch (error) {
      setImagesState({
        status: "error",
        data: [],
        error: isApiError(error) ? error.detail : "We couldn't load item images."
      });
    }
  }, [itemId]);

  React.useEffect(() => {
    void loadCollection();
    void loadItem();
  }, [loadCollection, loadItem]);

  React.useEffect(() => {
    void loadImages();
  }, [loadImages]);

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
      setItemState((prev) => {
        if (prev.status !== "ready" || !prev.data) {
          return prev;
        }
        return {
          ...prev,
          data: {
            ...prev.data,
            star_count: status.star_count
          }
        };
      });
    } catch (error) {
      if (!isApiError(error) || error.status !== 404) {
        setItemStarError(
          isApiError(error) ? error.detail : "We couldn't update star status."
        );
      }
    }
  }, [collectionId, itemIdParam, showAuthenticatedCtas]);

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
      setItemState((prev) => {
        if (prev.status !== "ready" || !prev.data) {
          return prev;
        }
        return {
          ...prev,
          data: {
            ...prev.data,
            star_count: status.star_count
          }
        };
      });
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
                />
                {showAuthenticatedCtas ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white/90 px-3 py-2 text-xs font-medium text-stone-700 shadow-sm transition hover:border-amber-300 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleToggleItemStar}
                    disabled={isUpdatingItemStar}
                  >
                    <Star className={`h-3.5 w-3.5 text-amber-600 ${itemStarred ? "fill-current" : ""}`} />
                    {itemState.data?.star_count ?? 0}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white/90 px-3 py-2 text-xs font-medium text-stone-700 shadow-sm">
                    <Star className="h-3.5 w-3.5 text-amber-600" />
                    {itemState.data?.star_count ?? 0}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCcw className="h-4 w-4" />
                  {t("Refresh")}
                </Button>
              </div>
            </div>
            {itemStarError ? (
              <p className="text-sm text-rose-600">{t(itemStarError)}</p>
            ) : null}

            {itemState.status === "loading" ? (
              <div
                className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
                aria-busy="true"
              >
                {t("Loading item details...")}
              </div>
            ) : itemState.status === "error" ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
                <p className="text-sm font-medium text-rose-700">
                  {t("We hit a snag loading this item.")}
                </p>
                <p className="mt-2 text-sm text-rose-600">
                  {t(itemState.error ?? "Please try again.")}
                </p>
                <div className="mt-4">
                  <Button variant="outline" onClick={handleRefresh}>
                    {t("Try again")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
                    {t("Item detail")}
                  </p>
                  <h1 className="font-display mt-4 text-3xl text-stone-900">
                    {itemState.data?.name}
                  </h1>
                  <p className="mt-3 text-sm text-stone-600">
                    {itemState.data?.notes?.trim()
                      ? itemState.data.notes
                      : t("No description provided.")}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3 text-xs">
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                      <Globe2 className="h-3.5 w-3.5" />
                      {t("Public item")}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 font-medium text-stone-600">
                      <ImageIcon className="h-3.5 w-3.5 text-amber-600" />
                      {t("{count} images", { count: imagesState.data?.length ?? 0 })}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 font-medium text-stone-600">
                      <Star className="h-3.5 w-3.5 text-amber-600" />
                      {t("{count} stars", { count: itemState.data?.star_count ?? 0 })}
                    </span>
                  </div>
                </div>

                <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                    {t("Item snapshot")}
                  </p>
                  <div className="mt-6 space-y-4 text-sm text-stone-600">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-stone-900">{t("Created")}</p>
                        <p>{formatDate(itemState.data?.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                        <RefreshCcw className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-stone-900">{t("Updated")}</p>
                        <p>{formatDate(itemState.data?.updated_at)}</p>
                      </div>
                    </div>
                    {collectionState.status === "ready" && collectionState.data ? (
                      <div className="rounded-2xl border border-stone-200 bg-white/90 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                          {t("Collection")}
                        </p>
                        <p className="mt-2 text-sm font-medium text-stone-900">
                          {collectionState.data.name}
                        </p>
                        {collectionState.data.owner_username ? (
                          <p className="mt-1 text-xs text-stone-500">
                            {t("By")}{" "}
                            <Link
                              href={`/profile/${encodeURIComponent(collectionState.data.owner_username)}`}
                              className="font-medium text-amber-700 hover:text-amber-800"
                            >
                              @{collectionState.data.owner_username}
                            </Link>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {itemState.status === "ready" ? (
          <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  {t("Images")}
                </p>
                <h2 className="font-display mt-3 text-2xl text-stone-900">
                  {t("Gallery")}
                </h2>
                <p className="mt-3 text-sm text-stone-600">
                  {t("Click any image to view it in detail.")}
                </p>

                {imagesState.status === "loading" ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-6 text-sm text-stone-500">
                    {t("Loading images...")}
                  </div>
                ) : imagesState.status === "error" ? (
                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                    {t(imagesState.error ?? "We couldn't load item images.")}
                  </div>
                ) : !imagesState.data?.length ? (
                  <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-10 text-center text-sm text-stone-500">
                    {t("No images uploaded for this item yet.")}
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {selectedImage ? (
                      <button
                        type="button"
                        className="block w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-50"
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
                          className={`overflow-hidden rounded-xl border bg-stone-50 ${
                            image.id === selectedImageId
                              ? "border-amber-400 ring-2 ring-amber-300/70"
                              : "border-stone-200"
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
              </div>

              <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  {t("Metadata")}
                </p>
                <h2 className="font-display mt-3 text-2xl text-stone-900">
                  {t("Shared attributes")}
                </h2>
                <p className="mt-3 text-sm text-stone-600">
                  {t("Complete data available for this public item.")}
                </p>

                {metadataEntries.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-6 text-sm text-stone-500">
                    {t("No metadata shared.")}
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {metadataEntries.map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-2xl border border-stone-200 bg-stone-50 p-3"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                          {key}
                        </p>
                        <p className="mt-1 text-sm text-stone-700">
                          {formatMetadataValue(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <Lightbox
        open={lightboxOpen}
        src={selectedImage ? imageApi.url(selectedImage.id, "original") : null}
        alt={itemState.data?.name}
        onClose={() => setLightboxOpen(false)}
      />
    </main>
  );
}

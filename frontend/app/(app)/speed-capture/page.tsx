"use client";

import { enqueuePhoto, resumeUpload, type UploadResult } from "@/lib/upload-queue";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  ImagePlus,
  Layers,
  Loader2,
  Plus,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  collectionApi,
  imageApi,
  isApiError,
  itemApi,
  type CollectionResponse,
  type ItemResponse,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { useAuthenticatedImageUrl } from "@/lib/use-authenticated-image";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CapturedImage = {
  id: string;
  imageId: number;
};

type CapturedItem = {
  itemId: number;
  name: string;
  images: CapturedImage[];
};

/**
 * A shot that has been taken but whose upload has not come back yet. It is
 * rendered from a local object URL so the photo appears the moment it is
 * taken, instead of after the round trip.
 */
type PendingShot = {
  id: string;
  previewUrl: string;
  mode: "new" | "same";
};

type CaptureState = {
  status: "pick-collection" | "capturing" | "reviewing";
  collections: CollectionResponse[];
  collectionsLoading: boolean;
  collectionsError: string | null;
  selectedCollection: CollectionResponse | null;
  items: CapturedItem[];
  currentItemId: number | null;
  currentUploadId: string | null;
  pendingShots: PendingShot[];
  uploadError: string | null;
  uploadErrorId: string | null;
  stats: { items: number; images: number };
  existingDrafts: ItemResponse[];
  existingDraftsLoading: boolean;
  existingDraftsHasMore: boolean;
};

function AuthenticatedImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const resolvedSrc = useAuthenticatedImageUrl(src);
  if (!resolvedSrc) {
    return <div aria-hidden="true" className={cn("bg-muted", className)} />;
  }
  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={512}
      height={512}
      className={className}
      unoptimized
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Collection Picker                                                  */
/* ------------------------------------------------------------------ */

function CollectionPicker({
  collections,
  loading,
  error,
  onSelect,
  onRetry,
}: {
  collections: CollectionResponse[];
  loading: boolean;
  error: string | null;
  onSelect: (c: CollectionResponse) => void;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted text-brand">
            <Zap className="h-8 w-8" />
          </div>
          <SectionHeading as="h1" className="mt-4">
            {t("Speed Capture")}
          </SectionHeading>
          <p className="mt-2 text-sm text-muted-strong">
            {t("Pick a collection to start capturing. You can add metadata later.")}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : error ? (
          <Alert className="p-4 space-y-3 text-center">
            <p className="text-sm text-destructive">{t(error)}</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              {t("Try again")}
            </Button>
          </Alert>
        ) : collections.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-strong">
              {t("No collections yet. Create one first.")}
            </p>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/collections/new">{t("Create collection")}</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {collections.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-sm transition hover:border-brand-border hover:bg-brand-muted/50 active:scale-[0.98]"
                onClick={() => onSelect(c)}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.name}
                  </p>
                  {c.description ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {c.description}
                    </p>
                  ) : null}
                </div>
                <ChevronDown className="h-4 w-4 -rotate-90 text-muted-subtle" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Thumbnail Strip                                                    */
/* ------------------------------------------------------------------ */

function ThumbnailStrip({
  items,
  currentItemId,
  pendingShots,
}: {
  items: CapturedItem[];
  currentItemId: number | null;
  pendingShots: PendingShot[];
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const currentItem = items.find((i) => i.itemId === currentItemId);
  const confirmed = currentItem?.images ?? [];

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [confirmed.length, pendingShots.length]);

  if (confirmed.length === 0 && pendingShots.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
    >
      {confirmed.map((img) => (
        <div
          key={img.id}
          className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border-2 border-white shadow-sm"
        >
          <AuthenticatedImage
            src={imageApi.url(img.imageId, "thumb")}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ))}
      {pendingShots.map((shot) => (
        <div
          key={shot.id}
          className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border-2 border-white shadow-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shot.previewUrl}
            alt=""
            className="h-full w-full object-cover opacity-60"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-panel/30">
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Capture Screen (viewport-fitted, no scroll)                        */
/* ------------------------------------------------------------------ */

function CaptureScreen({
  collection,
  items,
  currentItemId,
  currentUploadId,
  pendingShots,
  uploadError,
  stats,
  existingDrafts,
  existingDraftsLoading,
  onCapture,
  onLoadMoreDrafts,
  existingDraftsHasMore,
  onExit,
  onReview,
}: {
  collection: CollectionResponse;
  items: CapturedItem[];
  currentItemId: number | null;
  currentUploadId: string | null;
  pendingShots: PendingShot[];
  uploadError: string | null;
  stats: { items: number; images: number };
  existingDrafts: ItemResponse[];
  existingDraftsLoading: boolean;
  existingDraftsHasMore: boolean;
  onLoadMoreDrafts: () => void;
  onCapture: (file: File, mode: "new" | "same") => void;
  onExit: () => void;
  onReview: () => void;
}) {
  const { t, tc } = useI18n();
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const pendingModeRef = React.useRef<"new" | "same">("new");
  // A shot still in flight already counts: "Same Item" queues behind it.
  const hasCurrentItem =
    currentItemId !== null || currentUploadId !== null;
  const uploading = pendingShots.length > 0;

  const triggerCapture = (mode: "new" | "same") => {
    pendingModeRef.current = mode;
    cameraRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(file, pendingModeRef.current);
    }
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Hidden camera input */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-muted-strong transition hover:text-foreground"
          onClick={onExit}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("Exit")}
        </button>
        <p className="truncate text-xs uppercase tracking-[0.2em] text-brand">
          {collection.name}
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-center gap-6 py-2">
        <div className="text-center">
          <p className="font-display text-2xl text-foreground">{stats.items}</p>
          <p className="text-xs text-muted-foreground">
            {stats.items === 1 ? t("item") : t("items")}
          </p>
        </div>
        <div className="h-8 w-px bg-muted" />
        <div className="text-center">
          <p className="font-display text-2xl text-foreground">{stats.images}</p>
          <p className="text-xs text-muted-foreground">
            {stats.images === 1 ? t("photo") : t("photos")}
          </p>
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="min-h-[3.75rem] px-4">
        <ThumbnailStrip
          items={items}
          currentItemId={currentItemId}
          pendingShots={pendingShots}
        />
      </div>

      {/* Existing drafts */}
      {existingDraftsLoading ? (
        <div className="flex items-center justify-center px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-subtle" />
        </div>
      ) : existingDrafts.length > 0 ? (
        <div className="px-4 pt-2">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-subtle">
            {t("Existing drafts")}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {existingDrafts.map((draft) => (
              <Link
                key={draft.id}
                href={`/collections/${collection.id}/items/${draft.id}`}
                className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted shadow-sm"
              >
                {draft.primary_image_id ? (
                  <AuthenticatedImage
                    src={imageApi.url(draft.primary_image_id, "thumb")}
                    alt={draft.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera className="h-5 w-5 text-muted-subtle" />
                )}
                {(draft.image_count ?? 0) > 1 ? (
                  <span className="absolute bottom-0.5 right-0.5 rounded-full bg-panel/70 px-1 py-px text-[10px] font-medium text-white">
                    {draft.image_count}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {existingDraftsHasMore && <Button className="mx-4" variant="outline" disabled={existingDraftsLoading} onClick={onLoadMoreDrafts}>{t("Load more drafts")}</Button>}

      {/* Spacer / center area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-subtle">
          <Camera className="h-10 w-10" />
        </div>
        {uploading ? (
          <p className="flex items-center gap-2 text-sm text-muted-strong">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            {tc(pendingShots.length, "{count} photo uploading", "{count} photos uploading")}
          </p>
        ) : (
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            {hasCurrentItem
              ? t("Add another photo to the current item, or start a new one.")
              : t("Take a photo to create your first draft item.")}
          </p>
        )}

        {uploadError ? (
          <Alert className="rounded-xl px-4 py-2">
            {t(uploadError)}
          </Alert>
        ) : null}
      </div>

      {/* Bottom action buttons — always visible */}
      <div className="space-y-3 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
        <div className="flex gap-3">
          <Button
            className="flex-1 gap-2 rounded-2xl py-6 text-base"
            onClick={() => triggerCapture("new")}
          >
            <Plus className="h-5 w-5" />
            {t("New Item")}
          </Button>
          {hasCurrentItem ? (
            <Button
              variant="secondary"
              className="flex-1 gap-2 rounded-2xl py-6 text-base"
              onClick={() => triggerCapture("same")}
            >
              <ImagePlus className="h-5 w-5" />
              {t("Same Item")}
            </Button>
          ) : null}
        </div>

        {stats.items > 0 ? (
          <Button
            variant="outline"
            className="w-full gap-2 rounded-2xl py-5"
            onClick={onReview}
            disabled={uploading}
          >
            <Check className="h-4 w-4" />
            {t("Done — Review drafts")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Review Screen                                                      */
/* ------------------------------------------------------------------ */

function ReviewScreen({
  collection,
  items,
  stats,
  onBack,
  onFinish,
}: {
  collection: CollectionResponse;
  items: CapturedItem[];
  stats: { items: number; images: number };
  onBack: () => void;
  onFinish: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-muted-strong transition hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("Back to capture")}
        </button>
      </div>

      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-muted text-success">
          <Check className="h-7 w-7" />
        </div>
        <SectionHeading className="mt-3">
          {t("Capture complete")}
        </SectionHeading>
        <p className="mt-1 text-sm text-muted-strong">
          {t("{items} items with {images} photos in {collection}", {
            items: stats.items,
            images: stats.images,
            collection: collection.name,
          })}
        </p>
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.itemId}
            href={`/collections/${collection.id}/items/${item.itemId}`}
            className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-brand-border hover:shadow-md"
          >
            {item.images[0] ? (
              <div className="aspect-square overflow-hidden bg-muted">
                <AuthenticatedImage
                  src={imageApi.url(item.images[0].imageId, "thumb")}
                  alt={item.name}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center bg-muted text-muted-subtle">
                <Camera className="h-8 w-8" />
              </div>
            )}
            <div className="p-3">
              <p className="truncate text-sm font-medium text-foreground">
                {item.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.images.length}{" "}
                {item.images.length === 1 ? t("photo") : t("photos")}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          className="flex-1 gap-2 rounded-2xl py-5"
          onClick={onFinish}
        >
          {t("Go to collection")}
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2 rounded-2xl py-5"
          onClick={onBack}
        >
          <Camera className="h-4 w-4" />
          {t("Capture more")}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function SpeedCapturePage() {
  const router = useRouter();
  const { t } = useI18n();

  const [state, setState] = React.useState<CaptureState>({
    status: "pick-collection",
    collections: [],
    collectionsLoading: true,
    collectionsError: null,
    selectedCollection: null,
    items: [],
    currentItemId: null,
    currentUploadId: null,
    pendingShots: [],
    uploadError: null,
    uploadErrorId: null,
    stats: { items: 0, images: 0 },
    existingDrafts: [],
    existingDraftsLoading: false,
    existingDraftsHasMore: false,
  });

  // Photos upload one after another so the capture screen never has to wait,
  // and so each shot knows which item the previous one created.
  const uploadChainRef = React.useRef<Promise<unknown>>(Promise.resolve());
  const enqueueChainRef = React.useRef<Promise<unknown>>(Promise.resolve());
  const captureGroupRef = React.useRef<{ uploadId: string; itemId?: number } | null>(null);
  const sessionRef = React.useRef(0);
  const previewUrlsRef = React.useRef(new Set<string>());
  React.useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);

  React.useEffect(() => {
    const completed = (event: Event) => {
      const result = (event as CustomEvent<UploadResult>).detail;
      const group = captureGroupRef.current;
      if (group && group.uploadId === result.upload_id) group.itemId = result.item_id;
      setState(current => {
        if (result.mode === "item" || current.selectedCollection?.id !== result.collection_id) return current;
        if (current.items.some(item => item.images.some(image => image.imageId === result.image_id))) return current;
        const exists = current.items.some(item => item.itemId === result.item_id);
        const image = { id: String(result.image_id), imageId: result.image_id };
        const items = exists
          ? current.items.map(item => item.itemId === result.item_id ? { ...item, images: [...item.images, image] } : item)
          : [...current.items, { itemId: result.item_id, name: result.item_name, images: [image] }];
        return { ...current, items,
          currentItemId: !group || group.itemId === result.item_id ? result.item_id : current.currentItemId,
          uploadError: current.uploadErrorId === result.upload_id ? null : current.uploadError,
          uploadErrorId: current.uploadErrorId === result.upload_id ? null : current.uploadErrorId,
          existingDrafts: current.existingDrafts.filter(item => item.id !== result.item_id),
          stats: { items: items.length, images: current.stats.images + 1 } };
      });
    };
    window.addEventListener("photo-uploaded", completed);
    return () => window.removeEventListener("photo-uploaded", completed);
  }, []);

  const collectionsQuery = useQuery({
    queryKey: queryKeys.collections.list(),
    queryFn: ({ signal }) => collectionApi.list({ signal })
  });

  const { refetch: refetchCollections } = collectionsQuery;
  const loadCollections = React.useCallback(() => {
    void refetchCollections();
  }, [refetchCollections]);

  // Mirror the shared collections cache into the capture session state.
  const collectionsData = collectionsQuery.data;
  const collectionsPending = collectionsQuery.isPending;
  const collectionsError = collectionsQuery.error;
  React.useEffect(() => {
    setState((s) => ({
      ...s,
      collections: collectionsData ?? s.collections,
      collectionsLoading: collectionsPending,
      collectionsError: collectionsError
        ? isApiError(collectionsError)
          ? collectionsError.detail
          : "Failed to load collections"
        : null
    }));
  }, [collectionsData, collectionsPending, collectionsError]);

  const handleSelectCollection = async (c: CollectionResponse) => {
    // A new session must not append to the previous collection's item.
    captureGroupRef.current = null;
    sessionRef.current += 1;
    setState((s) => ({
      ...s,
      status: "capturing",
      selectedCollection: c,
      items: [],
      currentItemId: null,
      currentUploadId: null,
      pendingShots: [],
      uploadError: null,
      uploadErrorId: null,
      stats: { items: 0, images: 0 },
      existingDrafts: [],
      existingDraftsLoading: true,
      existingDraftsHasMore: false,
    }));
    try {
      const drafts = await itemApi.list(c.id, {
        draftsOnly: true,
        limit: 100,
        sort: "-created_at",
      });
      const draftItems = drafts;
      setState((s) => s.selectedCollection?.id !== c.id ? s : ({
        ...s, existingDrafts: draftItems,
        existingDraftsLoading: false, existingDraftsHasMore: drafts.length === 100,
      }));
    } catch {
      setState((s) => ({ ...s, existingDraftsLoading: false }));
    }
  };

  const loadMoreDrafts = async () => {
    const collection = state.selectedCollection;
    if (!collection || state.existingDraftsLoading) return;
    setState(s => ({ ...s, existingDraftsLoading: true }));
    try {
      const drafts = await itemApi.list(collection.id, { draftsOnly: true, limit: 100, offset: state.existingDrafts.length, sort: "-created_at" });
      setState(s => s.selectedCollection?.id !== collection.id ? s : ({ ...s,
        existingDrafts: [...s.existingDrafts, ...drafts], existingDraftsLoading: false,
        existingDraftsHasMore: drafts.length === 100 }));
    } catch {
      setState(s => ({ ...s, existingDraftsLoading: false, uploadErrorId: null, uploadError: "Could not load drafts. Please retry." }));
    }
  };

  const handleCapture = (file: File, mode: "new" | "same") => {
    const collection = state.selectedCollection;
    if (!collection) return;

    const shot: PendingShot = {
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      mode
    };
    setState((s) => ({
      ...s,
      pendingShots: [...s.pendingShots, shot],
      uploadError: null,
      uploadErrorId: null
    }));

    const session = sessionRef.current;
    const parentUploadId = mode === "same" ? captureGroupRef.current?.uploadId : undefined;
    const parentItemId = mode === "same"
      ? (captureGroupRef.current ? captureGroupRef.current.itemId ?? null : state.currentItemId)
      : null;
    const isNew = mode === "new" || (!parentUploadId && parentItemId === null);
    if (isNew) {
      captureGroupRef.current = { uploadId: shot.id };
      setState(s => ({ ...s, currentItemId: null, currentUploadId: shot.id }));
    }
    previewUrlsRef.current.add(shot.previewUrl);

    // Only disk writes wait for one another. Every selected file is durable
    // before waiting for preceding network requests, including its parent link.
    const queued = enqueueChainRef.current.catch(() => {}).then(() => enqueuePhoto(
      isNew
        ? { mode: "capture-new", collection_id: collection.id }
        : { mode: "capture-add", collection_id: collection.id,
            ...(parentItemId === null ? {} : { item_id: parentItemId }) },
      file, { id: shot.id, parentUploadId }
    ));
    enqueueChainRef.current = queued.catch(() => {});
    const previous = uploadChainRef.current;
    uploadChainRef.current = queued
      .then(async id => { await previous.catch(() => {}); return resumeUpload(id); })
      .catch((error: unknown) => {
        if (sessionRef.current !== session) return;
        setState((s) => ({
          ...s,
          uploadErrorId: shot.id,
          uploadError: isApiError(error)
            ? error.detail
            : error instanceof Error
              ? error.message
              : "Failed to upload image"
        }));
      })
      .finally(() => {
        URL.revokeObjectURL(shot.previewUrl);
        previewUrlsRef.current.delete(shot.previewUrl);
        if (sessionRef.current !== session) return;
        setState((s) => ({
          ...s,
          pendingShots: s.pendingShots.filter((pending) => pending.id !== shot.id)
        }));
      });
  };

  const handleExit = () => {
    if (state.items.length > 0) {
      setState((s) => ({ ...s, status: "reviewing" }));
    } else {
      setState((s) => ({
        ...s,
        status: "pick-collection",
        selectedCollection: null,
        items: [],
        currentItemId: null,
        currentUploadId: null,
        uploadError: null,
        uploadErrorId: null,
        stats: { items: 0, images: 0 },
        existingDrafts: [],
        existingDraftsLoading: false,
      }));
    }
  };

  const handleReview = () => {
    setState((s) => ({ ...s, status: "reviewing" }));
  };

  const handleBackToCapture = () => {
    setState((s) => ({ ...s, status: "capturing" }));
  };

  const handleFinish = () => {
    if (state.selectedCollection) {
      router.push(
        `/collections/${state.selectedCollection.id}?include_drafts=true`
      );
    } else {
      router.push("/collections");
    }
  };

  if (state.status === "pick-collection") {
    return (
      <CollectionPicker
        collections={state.collections}
        loading={state.collectionsLoading}
        error={state.collectionsError}
        onSelect={handleSelectCollection}
        onRetry={loadCollections}
      />
    );
  }

  if (state.status === "reviewing" && state.selectedCollection) {
    return (
      <ReviewScreen
        collection={state.selectedCollection}
        items={state.items}
        stats={state.stats}
        onBack={handleBackToCapture}
        onFinish={handleFinish}
      />
    );
  }

  if (state.selectedCollection) {
    return (
      <CaptureScreen
        collection={state.selectedCollection}
        items={state.items}
        currentItemId={state.currentItemId}
        currentUploadId={state.currentUploadId}
        pendingShots={state.pendingShots}
        uploadError={state.uploadError}
        stats={state.stats}
        existingDrafts={state.existingDrafts}
        existingDraftsLoading={state.existingDraftsLoading}
        existingDraftsHasMore={state.existingDraftsHasMore}
        onLoadMoreDrafts={() => void loadMoreDrafts()}
        onCapture={handleCapture}
        onExit={handleExit}
        onReview={handleReview}
      />
    );
  }

  return null;
}

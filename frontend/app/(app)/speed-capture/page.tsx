"use client";

import * as React from "react";
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
  speedCaptureApi,
  type CollectionResponse,
  type ItemResponse,
} from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

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

type CaptureState = {
  status: "pick-collection" | "capturing" | "reviewing";
  collections: CollectionResponse[];
  collectionsLoading: boolean;
  collectionsError: string | null;
  selectedCollection: CollectionResponse | null;
  items: CapturedItem[];
  currentItemId: number | null;
  uploading: boolean;
  uploadError: string | null;
  stats: { items: number; images: number };
  existingDrafts: ItemResponse[];
  existingDraftsLoading: boolean;
};

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
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Zap className="h-8 w-8" />
          </div>
          <h1 className="font-display mt-4 text-2xl text-stone-900">
            {t("Speed Capture")}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {t("Pick a collection to start capturing. You can add metadata later.")}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
          </div>
        ) : error ? (
          <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center">
            <p className="text-sm text-rose-700">{t(error)}</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              {t("Try again")}
            </Button>
          </div>
        ) : collections.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-6 text-center">
            <p className="text-sm text-stone-600">
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
                className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-amber-300 hover:bg-amber-50/50 active:scale-[0.98]"
                onClick={() => onSelect(c)}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {c.name}
                  </p>
                  {c.description ? (
                    <p className="truncate text-xs text-stone-500">
                      {c.description}
                    </p>
                  ) : null}
                </div>
                <ChevronDown className="h-4 w-4 -rotate-90 text-stone-400" />
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
}: {
  items: CapturedItem[];
  currentItemId: number | null;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const currentItem = items.find((i) => i.itemId === currentItemId);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [currentItem?.images.length]);

  if (!currentItem || currentItem.images.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
    >
      {currentItem.images.map((img) => (
        <div
          key={img.id}
          className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border-2 border-white shadow-sm"
        >
          <img
            src={imageApi.url(img.imageId, "thumb")}
            alt=""
            className="h-full w-full object-cover"
          />
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
  uploading,
  uploadError,
  stats,
  existingDrafts,
  existingDraftsLoading,
  onCapture,
  onExit,
  onReview,
}: {
  collection: CollectionResponse;
  items: CapturedItem[];
  currentItemId: number | null;
  uploading: boolean;
  uploadError: string | null;
  stats: { items: number; images: number };
  existingDrafts: ItemResponse[];
  existingDraftsLoading: boolean;
  onCapture: (file: File, mode: "new" | "same") => void;
  onExit: () => void;
  onReview: () => void;
}) {
  const { t } = useI18n();
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const pendingModeRef = React.useRef<"new" | "same">("new");
  const hasCurrentItem = currentItemId !== null;

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
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-50">
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
          className="flex items-center gap-2 text-sm text-stone-600 transition hover:text-stone-900"
          onClick={onExit}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("Exit")}
        </button>
        <p className="truncate text-xs uppercase tracking-[0.2em] text-amber-700">
          {collection.name}
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-center gap-6 py-2">
        <div className="text-center">
          <p className="font-display text-2xl text-stone-900">{stats.items}</p>
          <p className="text-xs text-stone-500">
            {stats.items === 1 ? t("item") : t("items")}
          </p>
        </div>
        <div className="h-8 w-px bg-stone-200" />
        <div className="text-center">
          <p className="font-display text-2xl text-stone-900">{stats.images}</p>
          <p className="text-xs text-stone-500">
            {stats.images === 1 ? t("photo") : t("photos")}
          </p>
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="min-h-[3.75rem] px-4">
        <ThumbnailStrip items={items} currentItemId={currentItemId} />
      </div>

      {/* Existing drafts */}
      {existingDraftsLoading ? (
        <div className="flex items-center justify-center px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
        </div>
      ) : existingDrafts.length > 0 ? (
        <div className="px-4 pt-2">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-stone-400">
            {t("Existing drafts")}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {existingDrafts.map((draft) => (
              <Link
                key={draft.id}
                href={`/collections/${collection.id}/items/${draft.id}`}
                className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm"
              >
                {draft.primary_image_id ? (
                  <img
                    src={imageApi.url(draft.primary_image_id, "thumb")}
                    alt={draft.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera className="h-5 w-5 text-stone-400" />
                )}
                {(draft.image_count ?? 0) > 1 ? (
                  <span className="absolute bottom-0.5 right-0.5 rounded-full bg-stone-900/70 px-1 py-px text-[10px] font-medium text-white">
                    {draft.image_count}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Spacer / center area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
              <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
            </div>
            <p className="text-sm text-stone-600">{t("Uploading...")}</p>
          </div>
        ) : (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-stone-100 text-stone-400">
              <Camera className="h-10 w-10" />
            </div>
            <p className="max-w-xs text-center text-sm text-stone-500">
              {hasCurrentItem
                ? t("Add another photo to the current item, or start a new one.")
                : t("Take a photo to create your first draft item.")}
            </p>
          </>
        )}

        {uploadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {uploadError}
          </div>
        ) : null}
      </div>

      {/* Bottom action buttons — always visible */}
      <div className="space-y-3 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
        <div className="flex gap-3">
          <Button
            className="flex-1 gap-2 rounded-2xl py-6 text-base"
            onClick={() => triggerCapture("new")}
            disabled={uploading}
          >
            <Plus className="h-5 w-5" />
            {t("New Item")}
          </Button>
          {hasCurrentItem ? (
            <Button
              variant="secondary"
              className="flex-1 gap-2 rounded-2xl py-6 text-base"
              onClick={() => triggerCapture("same")}
              disabled={uploading}
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
          className="flex items-center gap-2 text-sm text-stone-600 transition hover:text-stone-900"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("Back to capture")}
        </button>
      </div>

      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Check className="h-7 w-7" />
        </div>
        <h2 className="font-display mt-3 text-2xl text-stone-900">
          {t("Capture complete")}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
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
            className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:border-amber-300 hover:shadow-md"
          >
            {item.images[0] ? (
              <div className="aspect-square overflow-hidden bg-stone-100">
                <img
                  src={imageApi.url(item.images[0].imageId, "thumb")}
                  alt={item.name}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center bg-stone-100 text-stone-400">
                <Camera className="h-8 w-8" />
              </div>
            )}
            <div className="p-3">
              <p className="truncate text-sm font-medium text-stone-900">
                {item.name}
              </p>
              <p className="text-xs text-stone-500">
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
    uploading: false,
    uploadError: null,
    stats: { items: 0, images: 0 },
    existingDrafts: [],
    existingDraftsLoading: false,
  });

  const loadCollections = React.useCallback(async () => {
    setState((s) => ({
      ...s,
      collectionsLoading: true,
      collectionsError: null,
    }));
    try {
      const data = await collectionApi.list();
      setState((s) => ({
        ...s,
        collections: data,
        collectionsLoading: false,
      }));
    } catch (error) {
      setState((s) => ({
        ...s,
        collectionsLoading: false,
        collectionsError: isApiError(error)
          ? error.detail
          : "Failed to load collections",
      }));
    }
  }, []);

  React.useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  const handleSelectCollection = async (c: CollectionResponse) => {
    setState((s) => ({
      ...s,
      status: "capturing",
      selectedCollection: c,
      existingDraftsLoading: true,
    }));
    try {
      const [drafts, session] = await Promise.all([
        itemApi.list(c.id, {
          includeDrafts: true,
          limit: 100,
          sort: "-created_at",
        }),
        speedCaptureApi.session(c.id),
      ]);
      const draftItems = drafts.filter((item) => item.is_draft);
      setState((s) => ({
        ...s,
        existingDrafts: draftItems,
        existingDraftsLoading: false,
        stats: {
          items: session.draft_count,
          images: session.total_images,
        },
      }));
    } catch {
      setState((s) => ({ ...s, existingDraftsLoading: false }));
    }
  };

  const handleCapture = async (file: File, mode: "new" | "same") => {
    if (!state.selectedCollection) return;

    setState((s) => ({ ...s, uploading: true, uploadError: null }));

    try {
      if (mode === "new" || state.currentItemId === null) {
        const result = await speedCaptureApi.newItem(
          state.selectedCollection.id,
          file
        );
        const newItem: CapturedItem = {
          itemId: result.item_id,
          name: result.item_name,
          images: [
            {
              id: `${result.image_id}`,
              imageId: result.image_id,
            },
          ],
        };
        setState((s) => {
          const items = [...s.items, newItem];
          return {
            ...s,
            uploading: false,
            items,
            currentItemId: result.item_id,
            stats: {
              items: s.stats.items + 1,
              images: s.stats.images + 1,
            },
          };
        });
      } else {
        const result = await speedCaptureApi.addImage(
          state.selectedCollection.id,
          state.currentItemId,
          file
        );
        setState((s) => {
          const items = s.items.map((item) =>
            item.itemId === s.currentItemId
              ? {
                  ...item,
                  images: [
                    ...item.images,
                    {
                      id: `${result.image_id}`,
                      imageId: result.image_id,
                    },
                  ],
                }
              : item
          );
          return {
            ...s,
            uploading: false,
            items,
            stats: {
              items: s.stats.items,
              images: s.stats.images + 1,
            },
          };
        });
      }
    } catch (error) {
      setState((s) => ({
        ...s,
        uploading: false,
        uploadError: isApiError(error)
          ? error.detail
          : "Failed to upload image",
      }));
    }
  };

  const handleExit = () => {
    if (state.items.length > 0) {
      setState((s) => ({ ...s, status: "reviewing" }));
    } else {
      setState((s) => ({
        ...s,
        status: "pick-collection",
        selectedCollection: null,
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
        uploading={state.uploading}
        uploadError={state.uploadError}
        stats={state.stats}
        existingDrafts={state.existingDrafts}
        existingDraftsLoading={state.existingDraftsLoading}
        onCapture={handleCapture}
        onExit={handleExit}
        onReview={handleReview}
      />
    );
  }

  return null;
}

"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Image as ImageIcon,
  RefreshCcw,
  Trash2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { Lightbox } from "@/components/lightbox";
import {
  imageApi,
  isApiError,
  type ItemImageResponse
} from "@/lib/api";
import { useAuthenticatedImageUrl } from "@/lib/use-authenticated-image";
import { cn } from "@/lib/utils";

const sortImages = (items: ItemImageResponse[]) =>
  [...items].sort((a, b) => a.position - b.position || a.id - b.id);

const arrayMove = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const result = [...items];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
};

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) {
    return "—";
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

function GalleryPreviewImage({
  src,
  alt
}: {
  src: string;
  alt: string;
}) {
  const resolvedSrc = useAuthenticatedImageUrl(src);
  if (!resolvedSrc) {
    return (
      <div
        aria-hidden="true"
        className="block h-36 w-full bg-gradient-to-br from-stone-100 to-stone-200"
      />
    );
  }
  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={640}
      height={360}
      className="block h-36 w-full object-cover"
      draggable={false}
      unoptimized
    />
  );
}

type ImageGalleryProps = {
  itemId?: number | string | null;
  disabled?: boolean;
  editable?: boolean;
  refreshToken?: number;
};

export function ImageGallery({
  itemId,
  disabled = false,
  editable = true,
  refreshToken
}: ImageGalleryProps) {
  const { t, locale } = useI18n();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [images, setImages] = React.useState<ItemImageResponse[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reorderError, setReorderError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isReordering, setIsReordering] = React.useState(false);
  const [deletePendingId, setDeletePendingId] = React.useState<number | null>(
    null
  );
  const [draggingId, setDraggingId] = React.useState<number | null>(null);
  const [dragOverId, setDragOverId] = React.useState<number | null>(null);
  const hasLoadedRef = React.useRef(false);
  const [lightboxImage, setLightboxImage] = React.useState<{
    src: string;
    alt: string;
  } | null>(null);
  const hiddenDragPreviewRef = React.useRef<HTMLSpanElement | null>(null);

  const canInteract = Boolean(itemId) && !disabled;
  const canEdit = canInteract && editable;
  const isBusy = isReordering || deletePendingId !== null;

  const loadImages = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (!itemId) {
        setStatus("error");
        setLoadError(t("Item ID is missing."));
        return;
      }
      if (!options?.silent) {
        setStatus("loading");
      }
      setLoadError(null);
      setDeleteError(null);
      try {
        const data = await imageApi.list(itemId);
        setImages(sortImages(data));
        setStatus("ready");
        hasLoadedRef.current = true;
      } catch (error) {
        setStatus("error");
        setLoadError(
          isApiError(error)
            ? t(error.detail)
            : t("We couldn't load item images.")
        );
      }
    },
    [itemId, t]
  );

  React.useEffect(() => {
    hasLoadedRef.current = false;
    if (!itemId) {
      setStatus("error");
      setLoadError(t("Item ID is missing."));
      return;
    }
    void loadImages();
  }, [itemId, loadImages, t]);

  React.useEffect(() => {
    if (!itemId || !hasLoadedRef.current) {
      return;
    }
    void loadImages({ silent: true });
  }, [refreshToken, itemId, loadImages]);

  const commitReorder = React.useCallback(
    async (
      image: ItemImageResponse,
      position: number,
      previous: ItemImageResponse[]
    ) => {
      if (!itemId) {
        return;
      }
      setIsReordering(true);
      setReorderError(null);
      try {
        await imageApi.update(itemId, image.id, { position });
        await loadImages({ silent: true });
      } catch (error) {
        setImages(previous);
        setReorderError(
          isApiError(error)
            ? error.detail
            : "We couldn't reorder images. Please try again."
        );
      } finally {
        setIsReordering(false);
      }
    },
    [itemId, loadImages]
  );

  const moveImage = React.useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!canInteract || isBusy) {
        return;
      }
      if (toIndex < 0 || toIndex >= images.length) {
        return;
      }
      const previous = images;
      const next = arrayMove(previous, fromIndex, toIndex);
      setImages(next);
      const moved = previous[fromIndex];
      await commitReorder(moved, toIndex, previous);
    },
    [canInteract, commitReorder, images, isBusy]
  );

  const handleDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    imageId: number
  ) => {
    if (!canInteract || isBusy) {
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(imageId));
    if (hiddenDragPreviewRef.current) {
      event.dataTransfer.setDragImage(hiddenDragPreviewRef.current, 0, 0);
    }
    setDraggingId(imageId);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    imageId: number
  ) => {
    if (!canInteract) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverId !== imageId) {
      setDragOverId(imageId);
    }
  };

  const handleDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    imageId: number
  ) => {
    if (!canInteract) {
      return;
    }
    event.preventDefault();
    const sourceId =
      draggingId ?? Number(event.dataTransfer.getData("text/plain"));
    if (!sourceId || sourceId === imageId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const fromIndex = images.findIndex((image) => image.id === sourceId);
    const toIndex = images.findIndex((image) => image.id === imageId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    await moveImage(fromIndex, toIndex);
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDelete = React.useCallback(
    async (image: ItemImageResponse) => {
      if (!itemId || deletePendingId) {
        return;
      }
    const confirmed = window.confirm(
      t('Delete "{filename}"? This cannot be undone.', {
        filename: image.filename || t("this image")
      })
    );
      if (!confirmed) {
        return;
      }
      setDeletePendingId(image.id);
      setDeleteError(null);
      setReorderError(null);
      try {
        await imageApi.delete(itemId, image.id);
        setImages((prev) => prev.filter((item) => item.id !== image.id));
        await loadImages({ silent: true });
      } catch (error) {
        setDeleteError(
          isApiError(error)
            ? t(error.detail)
            : t("We couldn't delete the image. Please try again.")
        );
      } finally {
        setDeletePendingId(null);
      }
    },
    [deletePendingId, itemId, loadImages, t]
  );

  return (
    <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            {t("Image gallery")}
          </p>
          <h3 className="font-display mt-3 text-2xl text-stone-900">
            {t("Arrange item imagery")}
          </h3>
          <p className="mt-3 max-w-xl text-sm text-stone-600">
            {t(
              "Drag images to reorder them or use the move controls to fine-tune the sequence."
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => loadImages()}
            disabled={!itemId}
          >
            <RefreshCcw className="h-4 w-4" />
            {t("Refresh")}
          </Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <ImageIcon className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {reorderError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-700">
            {t(reorderError)}
          </div>
        ) : null}

        {deleteError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-700">
            {t(deleteError)}
          </div>
        ) : null}

        {!canInteract ? (
          <div className="text-xs text-stone-500">
            {t("Finish loading the item to manage image order.")}
          </div>
        ) : null}

        {isReordering ? (
          <div className="text-xs text-amber-700">
            {t("Saving image order...")}
          </div>
        ) : null}

        {deletePendingId !== null ? (
          <div className="text-xs text-amber-700">
            {t("Deleting image...")}
          </div>
        ) : null}

        {status === "loading" ? (
          <div
            className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500"
            aria-busy="true"
          >
            {t("Loading images...")}
          </div>
        ) : status === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6">
            <p className="text-sm font-medium text-rose-700">
              {t("We couldn't load the image gallery.")}
            </p>
            <p className="mt-2 text-sm text-rose-600">
              {loadError ?? t("Please try again.")}
            </p>
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={() => loadImages()}>
                {t("Try again")}
              </Button>
            </div>
          </div>
        ) : images.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
            {t("No images yet. Upload imagery to start building this gallery.")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image, index) => {
              const isFirst = index === 0;
              const isLast = index === images.length - 1;

              return (
                <div
                  key={image.id}
                  className={cn(
                    "rounded-2xl border bg-white/80 p-4 shadow-sm transition",
                    dragOverId === image.id
                      ? "border-amber-300 bg-amber-50/70"
                      : "border-stone-200"
                  )}
                  onDragOver={(event) => handleDragOver(event, image.id)}
                  onDrop={(event) => handleDrop(event, image.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl border text-stone-500 transition",
                        draggingId === image.id
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-stone-200 bg-stone-50 hover:border-stone-300",
                        canInteract && !isBusy
                          ? "cursor-ew-resize"
                          : "cursor-default"
                      )}
                      draggable={canInteract && !isBusy}
                      aria-label={t("Drag to reorder {filename}", {
                        filename: image.filename || t("this image")
                      })}
                      onDragStart={(event) =>
                        handleDragStart(event, image.id)
                      }
                      onDragEnd={handleDragEnd}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500">
                      {index + 1}
                    </span>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                    <button
                      type="button"
                      className="block w-full p-0"
                      onDragStart={(event) => event.preventDefault()}
                      onClick={() =>
                        setLightboxImage({
                          src: imageApi.url(image.id, "original"),
                          alt: image.filename || t("Item image")
                        })
                      }
                    >
                      <GalleryPreviewImage
                        src={imageApi.url(image.id, "medium")}
                        alt={image.filename || t("Item image")}
                      />
                    </button>
                  </div>

                  <div className="mt-3">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {image.filename || t("Untitled image")}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {t("Added {date}", {
                        date: formatDate(image.created_at, locale)
                      })}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveImage(index, index - 1)}
                      disabled={!canInteract || isBusy || isFirst}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {t("Move left")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveImage(index, index + 1)}
                      disabled={!canInteract || isBusy || isLast}
                    >
                      <ArrowRight className="h-4 w-4" />
                      {t("Move right")}
                    </Button>
                    {editable ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => handleDelete(image)}
                        disabled={!canEdit || isBusy}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletePendingId === image.id
                          ? t("Deleting...")
                          : t("Delete")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Lightbox
        open={Boolean(lightboxImage)}
        src={lightboxImage?.src ?? null}
        alt={lightboxImage?.alt}
        onClose={() => setLightboxImage(null)}
      />
      <span
        ref={hiddenDragPreviewRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      />
    </div>
  );
}

"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Loader2,
  Trash2
} from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Lightbox } from "@/components/lightbox";
import {
  imageApi,
  isApiError,
  type ItemImageResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useAuthenticatedImageUrl } from "@/lib/use-authenticated-image";
import { cn } from "@/lib/utils";
import { Card, EmptyState } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

const sortImages = (items: ItemImageResponse[]) =>
  [...items].sort((a, b) => a.position - b.position || a.id - b.id);

const arrayMove = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const result = [...items];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
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
        className="block h-full w-full bg-muted"
      />
    );
  }
  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={640}
      height={640}
      className="block h-full w-full object-cover"
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
  className?: string;
  /** Rendered at the bottom of the panel, e.g. the upload area. */
  footer?: (state: { hasPhotos: boolean }) => React.ReactNode;
};

export function ImageGallery({
  itemId,
  disabled = false,
  editable = true,
  refreshToken,
  className,
  footer
}: ImageGalleryProps) {
  const { t, tc } = useI18n();
  const confirm = useConfirm();
  const numericItemId = Number(itemId);
  const hasItemId = Boolean(itemId) && Number.isFinite(numericItemId);

  const imagesQuery = useQuery({
    queryKey: queryKeys.items.images(numericItemId),
    queryFn: ({ signal }) => imageApi.list(numericItemId, { signal }),
    enabled: hasItemId
  });

  // Local copy so drag-reordering can update optimistically; it is re-synced
  // from the query whenever the server result changes.
  const [images, setImages] = React.useState<ItemImageResponse[]>([]);

  React.useEffect(() => {
    if (imagesQuery.data) {
      setImages(sortImages(imagesQuery.data));
    }
  }, [imagesQuery.data]);

  const status: "loading" | "ready" | "error" = !hasItemId
    ? "error"
    : imagesQuery.isError
      ? "error"
      : imagesQuery.isPending
        ? "loading"
        : "ready";
  const loadError = !hasItemId
    ? t("Item ID is missing.")
    : imagesQuery.isError
      ? isApiError(imagesQuery.error)
        ? t(imagesQuery.error.detail)
        : t("We couldn't load item images.")
      : null;
  const [reorderError, setReorderError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isReordering, setIsReordering] = React.useState(false);
  const [deletePendingId, setDeletePendingId] = React.useState<number | null>(
    null
  );
  const [draggingId, setDraggingId] = React.useState<number | null>(null);
  const [dragOverId, setDragOverId] = React.useState<number | null>(null);
  const [lightboxImageId, setLightboxImageId] = React.useState<number | null>(null);
  const hiddenDragPreviewRef = React.useRef<HTMLSpanElement | null>(null);
  const lightboxIndex = images.findIndex((image) => image.id === lightboxImageId);
  const lightboxImage = lightboxIndex === -1 ? undefined : images[lightboxIndex];

  const canInteract = Boolean(itemId) && !disabled;
  const canEdit = canInteract && editable;
  const isBusy = isReordering || deletePendingId !== null;

  const { refetch: refetchImages } = imagesQuery;
  const loadImages = React.useCallback(async () => {
    await refetchImages();
  }, [refetchImages]);

  // The parent bumps `refreshToken` after an upload completes. Only react to
  // actual changes — on mount the query has already fetched.
  const lastRefreshToken = React.useRef(refreshToken);
  React.useEffect(() => {
    if (lastRefreshToken.current === refreshToken) {
      return;
    }
    lastRefreshToken.current = refreshToken;
    if (hasItemId) {
      void refetchImages();
    }
  }, [refreshToken, hasItemId, refetchImages]);

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
        await loadImages();
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
      const confirmed = await confirm({
        title: t('Delete "{filename}"? This cannot be undone.', {
          filename: image.filename || t("this image")
        }),
        confirmLabel: t("Delete"),
        tone: "destructive"
      });
      if (!confirmed) {
        return;
      }
      setDeletePendingId(image.id);
      setDeleteError(null);
      setReorderError(null);
      try {
        await imageApi.delete(itemId, image.id);
        setImages((prev) => prev.filter((item) => item.id !== image.id));
        await loadImages();
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
    [confirm, deletePendingId, itemId, loadImages, t]
  );

  const tileAction =
    "flex h-8 w-8 items-center justify-center rounded-lg text-muted-strong transition hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35";

  return (
    <Card className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>
          {t("Photos")}
        </Eyebrow>
        {images.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {tc(images.length, "{count} photo", "{count} photos")}
          </span>
        ) : null}
      </div>
      {editable && images.length > 1 ? (
        <p className="mt-2 text-sm text-muted-strong">
          {t("Drag photos into a new order. Changes are saved immediately.")}
        </p>
      ) : null}

      {/* Columns follow the panel's own width, so the grid fits whether the
          panel spans the page or sits in the narrower desktop column. */}
      <div className="@container mt-5 space-y-4">
        {reorderError ? (
          <Alert className="text-xs">
            {t(reorderError)}
          </Alert>
        ) : null}

        {deleteError ? (
          <Alert className="text-xs">
            {t(deleteError)}
          </Alert>
        ) : null}

        {!canInteract ? (
          <div className="text-xs text-muted-foreground">
            {t("Finish loading the item to manage image order.")}
          </div>
        ) : null}

        {isReordering ? (
          <div className="text-xs text-brand">
            {t("Saving image order...")}
          </div>
        ) : null}

        {status === "loading" ? (
          <EmptyState size="sm"
            aria-busy="true">
            {t("Loading images...")}
          </EmptyState>
        ) : status === "error" ? (
          <Alert className="p-6">
            <p className="text-sm font-medium text-destructive">
              {t("We couldn't load the image gallery.")}
            </p>
            <p className="mt-2 text-sm text-destructive">
              {loadError ?? t("Please try again.")}
            </p>
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={() => loadImages()}>
                {t("Try again")}
              </Button>
            </div>
          </Alert>
        ) : images.length === 0 ? (
          footer ? null : (
            <EmptyState size="sm">
              {t("No images yet. Upload imagery to start building this gallery.")}
            </EmptyState>
          )
        ) : (
          <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4">
            {images.map((image, index) => {
              const isFirst = index === 0;
              const isLast = index === images.length - 1;
              const label = image.filename || t("Item image");

              return (
                <div
                  key={image.id}
                  title={image.filename || undefined}
                  className={cn(
                    "group overflow-hidden rounded-2xl border bg-card shadow-xs transition",
                    dragOverId === image.id
                      ? "border-brand ring-2 ring-ring/60"
                      : "border-border",
                    draggingId === image.id && "opacity-50"
                  )}
                  onDragOver={(event) => handleDragOver(event, image.id)}
                  onDrop={(event) => handleDrop(event, image.id)}
                >
                  <div className="relative aspect-square bg-muted">
                    <button
                      type="button"
                      className="block h-full w-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      onDragStart={(event) => event.preventDefault()}
                      onClick={() => setLightboxImageId(image.id)}
                      aria-label={t("Open photo")}
                    >
                      <GalleryPreviewImage
                        src={imageApi.url(image.id, "medium")}
                        alt={label}
                      />
                    </button>
                    <span
                      className={cn(
                        "pointer-events-none absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium shadow-xs",
                        isFirst
                          ? "bg-brand text-brand-foreground"
                          : "bg-background/85 text-foreground backdrop-blur-sm"
                      )}
                    >
                      {isFirst ? t("Main photo") : index + 1}
                    </span>
                    <button
                      type="button"
                      className={cn(
                        "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-background/85 text-muted-strong shadow-xs backdrop-blur-sm transition hover:text-foreground",
                        canInteract && !isBusy ? "cursor-grab active:cursor-grabbing" : "cursor-default"
                      )}
                      draggable={canInteract && !isBusy}
                      aria-label={t("Drag to reorder {filename}", {
                        filename: image.filename || t("this image")
                      })}
                      title={t("Drag to reorder {filename}", {
                        filename: image.filename || t("this image")
                      })}
                      onDragStart={(event) =>
                        handleDragStart(event, image.id)
                      }
                      onDragEnd={handleDragEnd}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 px-1.5 py-1.5">
                    <button
                      type="button"
                      className={tileAction}
                      onClick={() => moveImage(index, index - 1)}
                      disabled={!canInteract || isBusy || isFirst}
                      aria-label={t("Move left")}
                      title={t("Move left")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={tileAction}
                      onClick={() => moveImage(index, index + 1)}
                      disabled={!canInteract || isBusy || isLast}
                      aria-label={t("Move right")}
                      title={t("Move right")}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    {editable ? (
                      <button
                        type="button"
                        className={cn(tileAction, "ml-auto text-destructive hover:bg-destructive-muted hover:text-destructive")}
                        onClick={() => handleDelete(image)}
                        disabled={!canEdit || isBusy}
                        aria-label={t("Delete")}
                        title={t("Delete")}
                      >
                        {deletePendingId === image.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {footer && status !== "loading" ? (
          <div className={cn(images.length > 0 && "border-t border-border pt-5")}>
            {footer({ hasPhotos: images.length > 0 })}
          </div>
        ) : null}
      </div>

      <Lightbox
        open={lightboxImage !== undefined}
        src={lightboxImage ? imageApi.url(lightboxImage.id, "large") : null}
        alt={lightboxImage ? lightboxImage.filename || t("Item image") : undefined}
        onClose={() => setLightboxImageId(null)}
        navigation={{
          index: lightboxIndex,
          total: images.length,
          onPrevious: () =>
            setLightboxImageId(images[(lightboxIndex - 1 + images.length) % images.length].id),
          onNext: () => setLightboxImageId(images[(lightboxIndex + 1) % images.length].id)
        }}
      />
      <span
        ref={hiddenDragPreviewRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      />
    </Card>
  );
}

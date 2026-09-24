"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Image as ImageIcon,
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
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

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
        className="block h-36 w-full bg-linear-to-br from-muted to-muted"
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
  const [lightboxImage, setLightboxImage] = React.useState<{
    src: string;
    alt: string;
  } | null>(null);
  const hiddenDragPreviewRef = React.useRef<HTMLSpanElement | null>(null);

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

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>
            {t("Image gallery")}
          </Eyebrow>
          <SectionHeading as="h3" className="mt-3">
            {t("Arrange item imagery")}
          </SectionHeading>
          <p className="mt-3 max-w-xl text-sm text-muted-strong">
            {t(
              "Drag images to reorder them or use the move controls to fine-tune the sequence."
            )}
          </p>
          {editable ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Photo changes are saved immediately.")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-muted text-brand">
            <ImageIcon className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
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

        {deletePendingId !== null ? (
          <div className="text-xs text-brand">
            {t("Deleting image...")}
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
          <EmptyState size="sm">
            {t("No images yet. Upload imagery to start building this gallery.")}
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image, index) => {
              const isFirst = index === 0;
              const isLast = index === images.length - 1;

              return (
                <div
                  key={image.id}
                  className={cn(
                    "rounded-2xl border bg-card/80 p-4 shadow-xs transition",
                    dragOverId === image.id
                      ? "border-brand-border bg-brand-muted/70"
                      : "border-border"
                  )}
                  onDragOver={(event) => handleDragOver(event, image.id)}
                  onDrop={(event) => handleDrop(event, image.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl border text-muted-foreground transition",
                        draggingId === image.id
                          ? "border-brand-border bg-brand-muted text-brand"
                          : "border-border bg-background hover:border-muted-subtle",
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
                    <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      {index + 1}
                    </span>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background">
                    <button
                      type="button"
                      className="block w-full p-0"
                      onDragStart={(event) => event.preventDefault()}
                      onClick={() =>
                        setLightboxImage({
                          src: imageApi.url(image.id, "large"),
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
                    <p className="truncate text-sm font-medium text-foreground">
                      {image.filename || t("Untitled image")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("Added {date}", {
                        date: formatDate(image.created_at, locale)
                      })}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                        className="text-destructive hover:bg-destructive-muted hover:text-destructive"
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
    </Card>
  );
}

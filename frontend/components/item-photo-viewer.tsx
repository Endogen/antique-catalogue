"use client";

import * as React from "react";
import Image from "next/image";
import { Camera, Expand } from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { Lightbox } from "@/components/lightbox";
import { Alert } from "@/components/ui/alert";
import { imageApi, type ItemImageResponse } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useAuthenticatedImageUrl } from "@/lib/use-authenticated-image";
import { cn } from "@/lib/utils";

const sortImages = (items: ItemImageResponse[]) =>
  [...items].sort((a, b) => a.position - b.position || a.id - b.id);

function PhotoImage({
  src,
  alt,
  className,
  size
}: {
  src: string;
  alt: string;
  className: string;
  size: number;
}) {
  const resolvedSrc = useAuthenticatedImageUrl(src);
  if (!resolvedSrc) {
    return <div aria-hidden="true" className={cn("bg-muted", className)} />;
  }
  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={size}
      height={size}
      className={className}
      draggable={false}
      unoptimized
    />
  );
}

type ItemPhotoViewerProps = {
  itemId: number;
  itemName: string;
  /** Shown when the item has no photos yet, e.g. a button into edit mode. */
  emptyAction?: React.ReactNode;
  className?: string;
};

/**
 * Read-only photo presentation for an item: one large photo filling its frame,
 * with thumbnails to switch between photos and a lightbox showing the whole,
 * uncropped photo.
 * Arranging and uploading photos happens in edit mode.
 */
export function ItemPhotoViewer({
  itemId,
  itemName,
  emptyAction,
  className
}: ItemPhotoViewerProps) {
  const { t } = useI18n();
  const imagesQuery = useQuery({
    queryKey: queryKeys.items.images(itemId),
    queryFn: ({ signal }) => imageApi.list(itemId, { signal }),
    enabled: Number.isFinite(itemId)
  });
  const images = React.useMemo(
    () => sortImages(imagesQuery.data ?? []),
    [imagesQuery.data]
  );
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);

  // Follow the first photo until the viewer picks another, and fall back to it
  // if the selected photo disappears.
  const selectedIndex = Math.max(
    0,
    images.findIndex((image) => image.id === selectedId)
  );
  const selected = images[selectedIndex];

  if (imagesQuery.isPending) {
    return (
      <div
        aria-busy="true"
        className={cn("aspect-4/3 animate-pulse rounded-3xl bg-muted", className)}
      />
    );
  }

  if (imagesQuery.isError) {
    return (
      <Alert className={className}>
        {t("We couldn't load item images.")}
      </Alert>
    );
  }

  if (!selected) {
    return (
      <div
        className={cn(
          "flex aspect-4/3 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-card/80 p-6 text-center",
          className
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Camera className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-sm text-muted-strong">{t("No photos yet")}</p>
        {emptyAction}
      </div>
    );
  }

  const photoLabel = t("Photo {current} of {total}", {
    current: selectedIndex + 1,
    total: images.length
  });

  return (
    <section aria-label={t("Photos")} className={cn("space-y-3", className)}>
      <button
        type="button"
        className="group relative block w-full overflow-hidden rounded-3xl border border-border bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setLightboxOpen(true)}
        aria-label={t("Open photo")}
      >
        <PhotoImage
          key={selected.id}
          src={imageApi.url(selected.id, "large")}
          alt={images.length > 1 ? `${itemName} · ${photoLabel}` : itemName}
          size={1600}
          className="aspect-4/3 max-h-[70vh] w-full object-cover transition duration-300 ease-out starting:opacity-0"
        />
        <span className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground opacity-80 shadow-xs backdrop-blur-sm transition group-hover:opacity-100">
          <Expand className="h-4 w-4" aria-hidden="true" />
        </span>
        {images.length > 1 ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium tabular-nums text-foreground shadow-xs backdrop-blur-sm"
          >
            {selectedIndex + 1} / {images.length}
          </span>
        ) : null}
      </button>

      {images.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => {
            const isSelected = image.id === selected.id;
            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setSelectedId(image.id)}
                aria-label={t("Show photo {index}", { index: index + 1 })}
                aria-pressed={isSelected}
                className={cn(
                  "h-16 w-16 overflow-hidden rounded-xl border-2 bg-muted transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:h-20 sm:w-20",
                  isSelected
                    ? "border-brand"
                    : "border-transparent opacity-70 hover:opacity-100"
                )}
              >
                <PhotoImage
                  src={imageApi.url(image.id, "thumb")}
                  alt=""
                  size={200}
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <Lightbox
        open={lightboxOpen}
        src={imageApi.url(selected.id, "large")}
        alt={itemName}
        onClose={() => setLightboxOpen(false)}
        navigation={{
          index: selectedIndex,
          total: images.length,
          onPrevious: () =>
            setSelectedId(images[(selectedIndex - 1 + images.length) % images.length].id),
          onNext: () => setSelectedId(images[(selectedIndex + 1) % images.length].id)
        }}
      />
    </section>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Image as ImageIcon, Star } from "lucide-react";

import { useAuthenticatedImageUrl } from "@/lib/use-authenticated-image";
import { cn } from "@/lib/utils";

type ItemPreviewMetadataEntry = {
  label: string;
  value: string;
};

type ItemPreviewCardProps = {
  href: string;
  title: string;
  eyebrow: string;
  createdLabel?: string;
  description?: string | null;
  descriptionFallback: string;
  metadata?: ItemPreviewMetadataEntry[];
  metadataFallback: string;
  metadataOverflowLabel?: string;
  imageSrc?: string | null;
  imageAlt?: string;
  imageFallbackLabel: string;
  starCount?: number;
  imageCount?: number;
  imageCountLabel?: string;
  isHighlighted?: boolean;
  highlightClassName?: string;
  onToggleStar?: () => void;
  isStarred?: boolean;
  starDisabled?: boolean;
  openLabel: string;
  className?: string;
};

const truncate = (value: string, maxLength: number) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;

export function ItemPreviewCard({
  href,
  title,
  eyebrow,
  createdLabel,
  description,
  descriptionFallback,
  metadata = [],
  metadataFallback,
  metadataOverflowLabel,
  imageSrc,
  imageAlt,
  imageFallbackLabel,
  starCount,
  imageCount,
  imageCountLabel,
  isHighlighted = false,
  highlightClassName,
  onToggleStar,
  isStarred = false,
  starDisabled = false,
  openLabel,
  className
}: ItemPreviewCardProps) {
  const shortTitle = truncate(title, 70);
  const descriptionText = description?.trim()
    ? truncate(description, 180)
    : descriptionFallback;
  const visibleMetadata = metadata.slice(0, 2);
  const hasOverflowMetadata = metadata.length > visibleMetadata.length;
  const resolvedImageSrc = useAuthenticatedImageUrl(imageSrc ?? null);

  return (
    <article
      className={cn(
        "flex h-full min-h-[31rem] flex-col rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm",
        isHighlighted ? highlightClassName : null,
        className
      )}
    >
      <Link href={href} className="flex flex-1 flex-col">
        <div className="h-44 overflow-hidden rounded-2xl border border-stone-100 bg-stone-50">
          {resolvedImageSrc ? (
            <Image
              src={resolvedImageSrc}
              alt={imageAlt ?? title}
              width={640}
              height={352}
              className="block h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-stone-100 via-stone-50 to-amber-100/50 text-stone-500">
              <ImageIcon className="h-5 w-5 text-amber-700" />
              <p className="text-xs uppercase tracking-[0.2em]">{imageFallbackLabel}</p>
            </div>
          )}
        </div>

        <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.3em] text-stone-400">
          {eyebrow}
        </p>
        <h3 className="mt-2 min-h-[3.25rem] text-lg font-semibold leading-snug text-stone-900">
          {shortTitle}
        </h3>
        <p className="mt-1 min-h-[1.25rem] text-xs text-stone-500">
          {createdLabel ?? "\u00a0"}
        </p>

        <p className="mt-3 min-h-[3.5rem] text-sm text-stone-600">{descriptionText}</p>

        <div className="mt-4 h-24 rounded-2xl border border-stone-100 bg-stone-50 px-3 py-3 text-xs text-stone-600">
          {visibleMetadata.length === 0 ? (
            <p className="text-stone-500">{metadataFallback}</p>
          ) : (
            <div className="space-y-2">
              {visibleMetadata.map((entry) => (
                <div
                  key={`${entry.label}-${entry.value}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="font-medium text-stone-700">
                    {truncate(entry.label, 24)}
                  </span>
                  <span className="text-right text-stone-500">
                    {truncate(entry.value, 28)}
                  </span>
                </div>
              ))}
              {hasOverflowMetadata ? (
                <p className="text-[11px] text-stone-400">
                  {metadataOverflowLabel ?? `+${metadata.length - visibleMetadata.length} more`}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {typeof starCount === "number"
            ? onToggleStar ? (
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600 transition",
                    "hover:border-amber-300 hover:text-amber-700",
                    starDisabled ? "cursor-not-allowed opacity-60" : null
                  )}
                  onClick={onToggleStar}
                  disabled={starDisabled}
                >
                  <Star className={cn("h-3.5 w-3.5", isStarred ? "fill-current text-amber-600" : "text-amber-600")} />
                  {starCount}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600">
                  <Star className="h-3.5 w-3.5 text-amber-600" />
                  {starCount}
                </span>
              )
            : null}

          {typeof imageCount === "number" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600">
              <ImageIcon className="h-3.5 w-3.5 text-amber-600" />
              {typeof imageCountLabel === "string" && imageCountLabel.trim()
                ? imageCountLabel
                : imageCount}
            </span>
          ) : null}
        </div>

        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.2em] text-stone-500 transition hover:text-stone-900"
        >
          {openLabel}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

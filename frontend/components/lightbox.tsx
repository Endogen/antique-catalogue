"use client";

import * as React from "react";
import Image from "next/image";
import { X } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { useAuthenticatedImageUrl } from "@/lib/use-authenticated-image";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

type LightboxProps = {
  open: boolean;
  src: string | null;
  alt?: string;
  onClose: () => void;
};

export function Lightbox({ open, src, alt, onClose }: LightboxProps) {
  const { t } = useI18n();
  const resolvedSrc = useAuthenticatedImageUrl(src);
  const isOpen = open && Boolean(src);
  // Handles Escape, body scroll lock, focus containment and focus restore.
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  const labelId = React.useId();

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/90 p-6 transition-opacity duration-200 starting:opacity-0"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={alt ? undefined : t("Expanded image")}
        aria-labelledby={alt ? labelId : undefined}
        tabIndex={-1}
        className={cn(
          "relative max-h-full max-w-5xl outline-hidden transition duration-300 ease-out starting:opacity-0 motion-safe:starting:scale-95",
          "rounded-2xl border border-white/10 bg-black/20 p-2"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="absolute -top-14 right-0 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/70"
          onClick={onClose}
          aria-label={t("Close image")}
        >
          <X className="h-5 w-5" />
        </button>
        {resolvedSrc ? (
          <Image
            src={resolvedSrc}
            alt={alt ?? t("Expanded image")}
            width={1600}
            height={1200}
            className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain"
            unoptimized
          />
        ) : (
          <p className="px-6 py-12 text-center text-sm text-panel-muted-foreground">
            {t("Loading image...")}
          </p>
        )}
        {alt ? (
          <p id={labelId} className="mt-3 text-center text-xs text-panel-muted-foreground">
            {alt}
          </p>
        ) : null}
      </div>
    </div>
  );
}

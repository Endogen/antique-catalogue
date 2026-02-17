"use client";

import * as React from "react";
import Image from "next/image";
import { X } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { useAuthenticatedImageUrl } from "@/lib/use-authenticated-image";
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
  React.useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || !src) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/90 p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
        onClick={onClose}
        aria-label={t("Close image")}
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className={cn(
          "max-h-full max-w-5xl",
          "rounded-2xl border border-white/10 bg-black/20 p-2"
        )}
        onClick={(event) => event.stopPropagation()}
      >
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
          <p className="px-6 py-12 text-center text-sm text-stone-200">
            {t("Loading image...")}
          </p>
        )}
        {alt ? (
          <p className="mt-3 text-center text-xs text-stone-200">{alt}</p>
        ) : null}
      </div>
    </div>
  );
}

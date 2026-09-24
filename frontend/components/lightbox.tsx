"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { useAuthenticatedImageUrl } from "@/lib/use-authenticated-image";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

type LightboxProps = {
  open: boolean;
  src: string | null;
  alt?: string;
  onClose: () => void;
  /**
   * Browsing through a set of photos. Previous/next buttons, the arrow keys
   * and horizontal swipes step through them; omit for a single photo.
   */
  navigation?: {
    index: number;
    total: number;
    onPrevious: () => void;
    onNext: () => void;
  };
};

/** A horizontal swipe shorter than this is treated as a tap. */
const SWIPE_THRESHOLD_PX = 50;

const navButtonClassName =
  "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/65 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/70";

export function Lightbox({ open, src, alt, onClose, navigation }: LightboxProps) {
  const { t } = useI18n();
  const resolvedSrc = useAuthenticatedImageUrl(src);
  const isOpen = open && Boolean(src);
  // Handles Escape, body scroll lock, focus containment and focus restore.
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  const labelId = React.useId();
  const swipeStart = React.useRef<{ x: number; y: number } | null>(null);
  const canNavigate = Boolean(navigation && navigation.total > 1);

  // While the next photo loads, keep the current one on screen so the frame
  // and its buttons don't collapse and jump.
  const [displaySrc, setDisplaySrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (resolvedSrc) {
      setDisplaySrc(resolvedSrc);
    }
  }, [resolvedSrc]);
  React.useEffect(() => {
    if (!isOpen) {
      setDisplaySrc(null);
    }
  }, [isOpen]);
  const shownSrc = resolvedSrc ?? displaySrc;

  // Keep the latest callbacks for the key listener without re-binding it.
  const navigationRef = React.useRef(navigation);
  React.useEffect(() => {
    navigationRef.current = navigation;
  });

  React.useEffect(() => {
    if (!isOpen || !canNavigate) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigationRef.current?.onPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        navigationRef.current?.onNext();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, canNavigate]);

  if (!isOpen) {
    return null;
  }

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = swipeStart.current;
    const touch = event.changedTouches[0];
    swipeStart.current = null;
    if (!start || !touch || !navigation || !canNavigate) {
      return;
    }
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) {
      return;
    }
    if (dx > 0) {
      navigation.onPrevious();
    } else {
      navigation.onNext();
    }
  };

  // Rendered at the document root: an ancestor that creates its own stacking
  // context (such as the sticky photo column) would otherwise let the app
  // header paint over the lightbox.
  return createPortal(
    // The whole screen is the dialog, so the counter, close and arrow buttons
    // can sit at the screen's corners and edges (always visible, however tall
    // the photo) while staying inside the focus trap. A click on the dimmed
    // backdrop itself closes it.
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt ? undefined : t("Expanded image")}
      aria-labelledby={alt ? labelId : undefined}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/90 px-4 pb-6 pt-16 outline-hidden transition-opacity duration-200 starting:opacity-0 short:py-3 sm:px-20"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between gap-4">
        {canNavigate && navigation ? (
          <p
            className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium tabular-nums text-white"
            aria-live="polite"
          >
            <span className="sr-only">
              {t("Photo {current} of {total}", {
                current: navigation.index + 1,
                total: navigation.total
              })}
            </span>
            <span aria-hidden="true">
              {navigation.index + 1} / {navigation.total}
            </span>
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/70"
          onClick={onClose}
          aria-label={t("Close image")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {canNavigate && navigation ? (
        <>
          <button
            type="button"
            className={cn(navButtonClassName, "left-3 sm:left-5")}
            onClick={navigation.onPrevious}
            aria-label={t("Previous photo")}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            className={cn(navButtonClassName, "right-3 sm:right-5")}
            onClick={navigation.onNext}
            aria-label={t("Next photo")}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      ) : null}

      <figure className="max-h-full max-w-full rounded-2xl border border-white/10 bg-black/20 p-2 transition duration-300 ease-out starting:opacity-0 motion-safe:starting:scale-95 short:border-0 short:bg-transparent short:p-0">
        {shownSrc ? (
          <Image
            key={shownSrc}
            src={shownSrc}
            alt={alt ?? t("Expanded image")}
            width={1600}
            height={1200}
            className="max-h-[calc(100dvh-9rem)] w-auto max-w-full rounded-xl object-contain transition-opacity duration-200 starting:opacity-0 short:max-h-[calc(100dvh-1.5rem)]"
            unoptimized
          />
        ) : (
          <p className="px-6 py-12 text-center text-sm text-panel-muted-foreground">
            {t("Loading image...")}
          </p>
        )}
        {alt ? (
          <figcaption id={labelId} className="mt-3 text-center text-xs text-panel-muted-foreground short:sr-only">
            {alt}
          </figcaption>
        ) : null}
      </figure>
    </div>,
    document.body
  );
}

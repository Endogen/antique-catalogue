import * as React from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

const getFocusable = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((element) => element.offsetParent !== null || element === document.activeElement);

/**
 * Open traps, oldest first. Every trap listens on `document`, so without this
 * a single Escape would close an entire stack of overlays at once: listeners
 * bound to the same node are not isolated from each other by stopPropagation,
 * and their firing order follows registration, not stacking order.
 * Only the most recently opened trap reacts to a key.
 */
const openTraps: { id: symbol; container: HTMLElement | null }[] = [];
let originalOverflow = "";
let originalFocus: HTMLElement | null = null;

/**
 * Makes an open overlay behave like a real modal dialog:
 * moves focus inside, keeps Tab cycling within it, closes on Escape,
 * locks body scroll, and restores focus to the trigger on close.
 */
export function useFocusTrap<T extends HTMLElement>(
  open: boolean,
  onClose?: () => void
) {
  const containerRef = React.useRef<T | null>(null);
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const trapId = Symbol("focus-trap");
    // All open traps share one scroll lock and the original page focus target.
    // Per-dialog snapshots would restore another dialog's "hidden" overflow
    // when dialogs close out of order or their page unmounts.
    if (openTraps.length === 0) {
      originalOverflow = document.body.style.overflow;
      originalFocus = previouslyFocused;
    }
    openTraps.push({ id: trapId, container });
    const isTopmost = () => openTraps[openTraps.length - 1]?.id === trapId;

    if (container) {
      const focusable = getFocusable(container);
      (focusable[0] ?? container).focus({ preventScroll: true });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Defer to whichever overlay is on top; it stops the event for the rest.
      if (!isTopmost()) {
        return;
      }

      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const node = containerRef.current;
      if (!node) {
        return;
      }

      const focusable = getFocusable(node);
      if (focusable.length === 0) {
        event.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!node.contains(active)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.body.style.overflow = "hidden";

    return () => {
      const wasTopmost = isTopmost();
      const index = openTraps.findIndex((trap) => trap.id === trapId);
      if (index !== -1) {
        openTraps.splice(index, 1);
      }
      document.removeEventListener("keydown", handleKeyDown, true);
      if (openTraps.length === 0) {
        document.body.style.overflow = originalOverflow;
        if (originalFocus?.isConnected) originalFocus.focus({ preventScroll: true });
        originalFocus = null;
      } else if (wasTopmost) {
        const remaining = openTraps[openTraps.length - 1].container;
        const target = previouslyFocused?.isConnected && remaining?.contains(previouslyFocused)
          ? previouslyFocused
          : remaining && (getFocusable(remaining)[0] ?? remaining);
        target?.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return containerRef;
}

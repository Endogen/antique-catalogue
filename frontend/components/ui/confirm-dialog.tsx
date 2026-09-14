"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [request, setRequest] = React.useState<ConfirmOptions | null>(null);
  // Held in a ref rather than in state: state updaters may run twice under
  // StrictMode, and settling a promise is a side effect.
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setRequest(options);
      }),
    []
  );

  const settle = React.useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolve?.(value);
  }, []);

  const handleCancel = React.useCallback(() => settle(false), [settle]);

  // A dialog unmounted while open must still resolve, or the caller hangs forever.
  React.useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    []
  );

  const containerRef = useFocusTrap<HTMLDivElement>(request !== null, handleCancel);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const isDestructive = request?.tone === "destructive";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
          onClick={handleCancel}
        >
          <div
            ref={containerRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={request.description ? descriptionId : undefined}
            tabIndex={-1}
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl outline-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                  isDestructive
                    ? "bg-destructive-muted text-destructive"
                    : "bg-brand-muted text-brand"
                )}
                aria-hidden="true"
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id={titleId}
                  className="font-display text-xl text-foreground"
                >
                  {request.title}
                </h2>
                {request.description ? (
                  <p
                    id={descriptionId}
                    className="mt-2 whitespace-pre-line text-sm text-muted-foreground"
                  >
                    {request.description}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCancel}>
                {request.cancelLabel ?? t("Cancel")}
              </Button>
              <Button
                type="button"
                variant={isDestructive ? "destructive" : "default"}
                onClick={() => settle(true)}
              >
                {request.confirmLabel ?? t("Confirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

/**
 * Returns an async `confirm(...)` that resolves true only if the user accepts.
 * Drop-in replacement for `window.confirm`, but styled, focus-trapped and i18n-aware.
 */
export function useConfirm(): ConfirmContextValue {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}

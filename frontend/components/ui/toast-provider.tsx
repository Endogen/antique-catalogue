"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

type ToastOptions = {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastRecord = {
  id: number;
  message: string;
  tone: ToastTone;
  durationMs: number;
};

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
};

const DEFAULT_DURATION_MS = 3000;
const ToastContext = React.createContext<ToastContextValue | null>(null);

let toastId = 0;

const toneStyles: Record<ToastTone, string> = {
  success: "border-emerald-300 text-emerald-800",
  error: "border-rose-300 text-rose-700",
  info: "border-stone-300 text-stone-800"
};

const iconStyles: Record<ToastTone, string> = {
  success: "text-emerald-600",
  error: "text-rose-600",
  info: "text-stone-600"
};

const toneIcon: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
};

function ToastItem({
  toast,
  onDismiss
}: {
  toast: ToastRecord;
  onDismiss: (id: number) => void;
}) {
  React.useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.durationMs, toast.id]);

  const Icon = toneIcon[toast.tone];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-md border bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-200",
        toneStyles[toast.tone]
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className={cn("h-4 w-4", iconStyles[toast.tone])} />
      <span>{toast.message}</span>
    </div>
  );
}

export function ToastProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);

  const dismissToast = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = React.useCallback((options: ToastOptions) => {
    toastId += 1;
    setToasts((current) => [
      ...current,
      {
        id: toastId,
        message: options.message,
        tone: options.tone ?? "info",
        durationMs: options.durationMs ?? DEFAULT_DURATION_MS
      }
    ]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
        {toasts.map((currentToast) => (
          <ToastItem key={currentToast.id} toast={currentToast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return context;
}

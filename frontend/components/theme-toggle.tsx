"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Quick light/dark switch for the app header. The full three-way preference
 * (including "match system") lives in Settings.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // The resolved theme is only known on the client; render a stable icon until
  // then so server and client markup agree.
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t("Switch to light theme") : t("Switch to dark theme")}
      title={isDark ? t("Switch to light theme") : t("Switch to dark theme")}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-strong transition hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}

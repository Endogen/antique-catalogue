"use client";

import { AlertTriangle } from "lucide-react";

import "./globals.css";
import { SectionHeading } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";

/**
 * Last-resort boundary: it replaces the root layout, so no provider, theme or
 * translation is available here. Kept deliberately self-contained and English.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6">
          <Card padding="lg">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive-muted text-destructive"
              aria-hidden="true"
            >
              <AlertTriangle className="h-5 w-5" />
            </span>
            <SectionHeading as="h1" size="xl" className="mt-5">
              The application failed to load.
            </SectionHeading>
            <p className="mt-3 text-sm text-muted-foreground">
              An unexpected error occurred before the page could be rendered.
              Your collection data has not been changed.
            </p>
            {error.digest ? (
              <p className="mt-4 font-mono text-xs text-muted-foreground/70">
                Reference: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
          </Card>
        </div>
      </body>
    </html>
  );
}

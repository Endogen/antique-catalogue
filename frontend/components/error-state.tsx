"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";

/**
 * Shared presentation for route error boundaries. Deliberately does not show
 * the raw error message — it can contain internal detail — but surfaces the
 * digest so a report can be matched to server logs.
 */
export function ErrorState({
  error,
  reset,
  showHomeLink = true
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  showHomeLink?: boolean;
}) {
  const { t } = useI18n();

  React.useEffect(() => {
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col justify-center py-16">
      <Card padding="lg">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive-muted text-destructive"
          aria-hidden="true"
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <Eyebrow className="mt-5" tone="brand" spacing="wide">
          {t("Something went wrong")}
        </Eyebrow>
        <SectionHeading as="h1" size="xl" className="mt-3">
          {t("This page could not be displayed.")}
        </SectionHeading>
        <p className="mt-3 text-sm text-muted-foreground">
          {t(
            "An unexpected error interrupted this view. Your collection data has not been changed."
          )}
        </p>
        {error.digest ? (
          <p className="mt-4 font-mono text-xs text-muted-foreground/70">
            {t("Reference")}: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          {reset ? (
            <Button type="button" onClick={reset}>
              <RefreshCcw className="h-4 w-4" />
              {t("Try again")}
            </Button>
          ) : null}
          {showHomeLink ? (
            <Button asChild variant="outline">
              <Link href="/">
                <Home className="h-4 w-4" />
                {t("Back to home")}
              </Link>
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

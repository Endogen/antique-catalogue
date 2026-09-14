"use client";

import Link from "next/link";
import { Compass, Home } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col justify-center px-6 py-16">
      <Card padding="lg">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-muted text-brand"
          aria-hidden="true"
        >
          <Compass className="h-5 w-5" />
        </span>
        <Eyebrow className="mt-5" tone="brand" spacing="wide">
          {t("Not found")}
        </Eyebrow>
        <SectionHeading as="h1" size="xl" className="mt-3">
          {t("This page does not exist.")}
        </SectionHeading>
        <p className="mt-3 text-sm text-muted-foreground">
          {t(
            "The link may be broken, or the collection or item may have been removed or made private."
          )}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/">
              <Home className="h-4 w-4" />
              {t("Back to home")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/explore">
              <Compass className="h-4 w-4" />
              {t("Explore collections")}
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

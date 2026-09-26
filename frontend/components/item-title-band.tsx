"use client";

import * as React from "react";
import { CalendarPlus, History, Sparkles, Star } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { SectionHeading } from "@/components/ui/typography";

type ItemTitleBandProps = {
  /** The link back to the item's collection, shown as a breadcrumb. */
  backLink: React.ReactNode;
  name: string;
  /** A status pill beside the name, e.g. while editing. */
  badge?: React.ReactNode;
  createdAt: string;
  updatedAt: string;
  starCount: number;
  isHighlight?: boolean;
  /** Buttons on the title row; they drop below it on phones. */
  actions?: React.ReactNode;
  /** Messages under the band, such as a failed star. */
  children?: React.ReactNode;
};

/**
 * The title band shared by the owner's and the public item page. It spans
 * the full width, so the photo and the details below start on one line.
 */
export function ItemTitleBand({
  backLink,
  name,
  badge,
  createdAt,
  updatedAt,
  starCount,
  isHighlight,
  actions,
  children
}: ItemTitleBandProps) {
  const { t, tc, locale } = useI18n();
  const formatDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(
          parsed
        );
  };

  return (
    <header className="space-y-2">
      {backLink}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <SectionHeading as="h1" size="xl" className="min-w-0 wrap-break-word">
              {name}
            </SectionHeading>
            {badge}
          </div>
          {/* Icons rather than dot separators, so wrapped lines never end or
              start with a stray dot. */}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("Created {date}", { date: formatDate(createdAt) })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              {t("Updated {date}", { date: formatDate(updatedAt) })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              {tc(starCount, "{count} star", "{count} stars")}
            </span>
            {isHighlight ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-brand-muted px-2.5 py-0.5 text-xs font-medium text-brand">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {t("Spotlight")}
              </span>
            ) : null}
          </p>
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap gap-2 *:grow sm:w-auto sm:*:grow-0">{actions}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}

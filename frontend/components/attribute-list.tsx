"use client";

import * as React from "react";
import { Lock } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

/** An item's metadata as a label/value list, read like an object record. */
export function AttributeList({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-border">{children}</dl>;
}

export function AttributeRow({
  label,
  value,
  isPrivate = false
}: {
  label: string;
  /** Empty values show a dash. */
  value: React.ReactNode;
  isPrivate?: boolean;
}) {
  const { t } = useI18n();
  const isMissing = value === null || value === undefined || value === "";
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-3 first:pt-1 last:pb-0">
      <dt className="flex items-start gap-1.5 text-sm text-muted-foreground">
        <span className="wrap-break-word">{label}</span>
        {isPrivate ? (
          <span className="mt-0.5 shrink-0" title={t("Private")}>
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{t("Private")}</span>
          </span>
        ) : null}
      </dt>
      <dd className={cn("text-sm wrap-break-word", isMissing ? "text-muted-subtle" : "text-foreground")}>
        {isMissing ? "—" : value}
      </dd>
    </div>
  );
}

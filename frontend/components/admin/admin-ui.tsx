"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/typography";
import { isApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export const ADMIN_PAGE_SIZE = 20;

export const ADMIN_SECTIONS = [
  "overview",
  "users",
  "collections",
  "items",
  "featured",
  "spotlight"
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

const isAdminSection = (value: string | null): value is AdminSection =>
  ADMIN_SECTIONS.includes(value as AdminSection);

type AdminParams = {
  section?: AdminSection;
  q?: string;
  page?: number;
  collection?: number | null;
};

/** Builds a console link, e.g. to a section searched for an owner's email. */
export const adminHref = ({ section, q, page, collection }: AdminParams) => {
  const params = new URLSearchParams();
  if (section && section !== "overview") params.set("section", section);
  if (q) params.set("q", q);
  if (page) params.set("page", String(page + 1));
  if (collection) params.set("collection", String(collection));
  const query = params.toString();
  return `/admin${query ? `?${query}` : ""}`;
};

/**
 * The console keeps its place in the URL: the open section, its search term,
 * page and filters. Reloading, sharing a link or going back restores it.
 */
export function useAdminParams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSection = searchParams.get("section");
  const section: AdminSection = isAdminSection(rawSection) ? rawSection : "overview";
  const q = (searchParams.get("q") ?? "").trim();
  const page = Math.max(0, (Number.parseInt(searchParams.get("page") ?? "1", 10) || 1) - 1);
  const collectionParam = Number.parseInt(searchParams.get("collection") ?? "", 10);
  const collection = Number.isFinite(collectionParam) && collectionParam > 0 ? collectionParam : null;

  const replace = React.useCallback(
    (next: AdminParams) => {
      router.replace(adminHref({ section, q, collection, ...next }), { scroll: false });
    },
    [collection, q, router, section]
  );

  return {
    section,
    q,
    page,
    collection,
    /** A new search starts again on the first page. */
    setQuery: React.useCallback((value: string) => replace({ q: value.trim(), page: 0 }), [replace]),
    setPage: React.useCallback((value: number) => replace({ page: value }), [replace]),
    setCollection: React.useCallback(
      (value: number | null) => replace({ collection: value, page: 0 }),
      [replace]
    )
  };
}

const SEARCH_DEBOUNCE_MS = 300;

type SearchFieldProps = {
  value: string;
  onSearch: (value: string) => void;
  placeholder: string;
  className?: string;
};

/**
 * Searches as you type (after a short pause) and immediately on Enter.
 * Escape or the clear button empties it.
 */
export function SearchField({ value, onSearch, placeholder, className }: SearchFieldProps) {
  const { t } = useI18n();
  const [draft, setDraft] = React.useState(value);
  const onSearchRef = React.useRef(onSearch);
  React.useEffect(() => {
    onSearchRef.current = onSearch;
  });

  // Follow the URL when it changes elsewhere, e.g. a link into this section.
  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  React.useEffect(() => {
    if (draft.trim() === value) {
      return;
    }
    const timer = window.setTimeout(() => onSearchRef.current(draft), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, value]);

  const clear = () => {
    setDraft("");
    onSearch("");
  };

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft);
      }}
    >
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-subtle"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && draft) {
            event.preventDefault();
            clear();
          }
        }}
        className="h-10 w-full rounded-full border border-border bg-card/90 pl-10 pr-10 text-sm text-foreground shadow-xs transition focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring [&::-webkit-search-cancel-button]:hidden"
      />
      {draft ? (
        <button
          type="button"
          onClick={clear}
          aria-label={t("Clear search")}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </form>
  );
}

type SectionHeaderProps = {
  title: string;
  description: string;
  aside?: React.ReactNode;
};

export function SectionHeader({ title, description, aside }: SectionHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <SectionHeading as="h1" size="xl">
          {title}
        </SectionHeading>
        <p className="mt-2 max-w-2xl text-sm text-muted-strong">{description}</p>
      </div>
      {aside}
    </header>
  );
}

/** The search field and filters above a list; results count on the right. */
export function Toolbar({
  children,
  summary
}: {
  children: React.ReactNode;
  summary?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
      {summary ? (
        <p className="text-sm text-muted-foreground sm:ml-auto" aria-live="polite">
          {summary}
        </p>
      ) : null}
    </div>
  );
}

const pillTones = {
  neutral: "border-border bg-background text-muted-strong",
  brand: "border-brand-border bg-brand-muted text-brand",
  success: "border-success-border bg-success-muted text-success",
  destructive: "border-destructive-border bg-destructive-muted text-destructive"
};

export function Pill({
  tone = "neutral",
  children,
  className
}: {
  tone?: keyof typeof pillTones;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        pillTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** A card holding one row per record, separated by hairlines. */
export function RowList({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <ul
      aria-label={label}
      className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card/90 shadow-xs"
    >
      {children}
    </ul>
  );
}

/**
 * One record: its title line, a meta line and any badges on the left, and
 * its actions on the right (below it on phones).
 */
export function Row({
  leading,
  title,
  badges,
  meta,
  detail,
  actions
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  detail?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 wrap-break-word text-sm font-semibold text-foreground">
              {title}
            </h3>
            {badges}
          </div>
          {meta ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {meta}
            </p>
          ) : null}
          {detail ? (
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-strong">{detail}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </li>
  );
}

/** A meta-line link that jumps to a related, pre-filtered section. */
export function MetaLink({
  href,
  children
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="underline decoration-border underline-offset-2 transition hover:text-foreground hover:decoration-current"
    >
      {children}
    </Link>
  );
}

export function Pagination({
  page,
  total,
  pageSize = ADMIN_PAGE_SIZE,
  onPage
}: {
  page: number;
  total: number;
  pageSize?: number;
  onPage: (page: number) => void;
}) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) {
    return null;
  }
  return (
    <nav
      aria-label={t("Pagination")}
      className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
    >
      <span>{t("Page {page} of {total}", { page: page + 1, total: pages })}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onPage(page - 1)} disabled={page === 0}>
          <ChevronLeft className="h-4 w-4" />
          {t("Previous")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages - 1}
        >
          {t("Next")}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

/** Loading, failure and empty states shared by every list. */
export function ListState({
  isPending,
  error,
  isEmpty,
  loadingLabel,
  emptyLabel,
  children
}: {
  isPending: boolean;
  error: unknown;
  isEmpty: boolean;
  loadingLabel: string;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  if (isPending) {
    return (
      <EmptyState size="sm" aria-busy="true">
        {loadingLabel}
      </EmptyState>
    );
  }
  if (error) {
    return <Alert>{t(isApiError(error) ? error.detail : "We couldn't load admin data.")}</Alert>;
  }
  if (isEmpty) {
    return <EmptyState size="sm">{emptyLabel}</EmptyState>;
  }
  return <>{children}</>;
}

export const destructiveButtonClassName =
  "border-destructive-border text-destructive hover:bg-destructive-muted hover:text-destructive";

export const formatAdminDate = (value: string | null | undefined, locale: string) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
};

/** Surfaces a failed write, e.g. a delete, above the list it concerns. */
export function useActionError() {
  const [error, setError] = React.useState<string | null>(null);
  const run = React.useCallback(async (action: () => Promise<unknown>, fallback: string) => {
    setError(null);
    try {
      await action();
      return true;
    } catch (caught) {
      setError(isApiError(caught) ? caught.detail : fallback);
      return false;
    }
  }, []);
  return { error, setError, run };
}

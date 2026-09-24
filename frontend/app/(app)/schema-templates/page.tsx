"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, PencilLine, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  isApiError,
  schemaTemplateApi,
  type SchemaTemplateSummaryResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";
import { Card, EmptyState } from "@/components/ui/card";

type TemplatesState = {
  status: "idle" | "loading" | "ready" | "error";
  data: SchemaTemplateSummaryResponse[];
  error?: string;
};

const formatDate = (value: string | null | undefined, locale: string) => {
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

export default function SchemaTemplatesPage() {
  const router = useRouter();
  const { t, tc, locale } = useI18n();
  const confirm = useConfirm();
  const [query, setQuery] = React.useState("");
  const queryClient = useQueryClient();
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [templateName, setTemplateName] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState<number | null>(null);
  const [copyPending, setCopyPending] = React.useState<number | null>(null);

  const term = useDebouncedValue(query).trim();
  const templatesQuery = useQuery({
    queryKey: [...queryKeys.schemaTemplates.list(), term],
    queryFn: ({ signal }) =>
      schemaTemplateApi.list({ q: term || undefined, limit: 100, signal })
  });

  const listState = toLoadState<SchemaTemplateSummaryResponse[]>(
    templatesQuery,
    "We couldn't load your schema templates.",
    []
  );
  // A failed delete or copy surfaces in the same banner as a failed load.
  const state: TemplatesState = actionError
    ? { ...listState, status: "error", error: actionError }
    : listState;

  const refresh = React.useCallback(() => {
    setActionError(null);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.schemaTemplates.all
    });
  }, [queryClient]);


  const handleCreate = async () => {
    if (isCreating) {
      return;
    }
    const normalizedName = templateName.trim();
    if (!normalizedName) {
      setCreateError("Template name is required.");
      return;
    }

    setCreateError(null);
    setIsCreating(true);
    try {
      const created = await schemaTemplateApi.create({ name: normalizedName });
      setTemplateName("");
      refresh();
      router.push(`/schema-templates/${created.id}`);
    } catch (error) {
      setCreateError(
        isApiError(error)
          ? error.detail
          : "We couldn't create the schema template."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (template: SchemaTemplateSummaryResponse) => {
    const confirmed = await confirm({
      title: t('Delete the "{name}" template? This cannot be undone.', {
        name: template.name
      }),
      confirmLabel: t("Delete"),
      tone: "destructive"
    });
    if (!confirmed) {
      return;
    }

    setDeletePending(template.id);
    try {
      await schemaTemplateApi.delete(template.id);
      setActionError(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.schemaTemplates.all
      });
    } catch (error) {
      setActionError(
        isApiError(error)
          ? error.detail
          : "We couldn't delete the schema template."
      );
    } finally {
      setDeletePending(null);
    }
  };

  const handleCopy = async (template: SchemaTemplateSummaryResponse) => {
    if (copyPending !== null) {
      return;
    }
    setCopyPending(template.id);
    try {
      const copied = await schemaTemplateApi.copy(template.id);
      router.push(`/schema-templates/${copied.id}`);
    } catch (error) {
      setActionError(
        isApiError(error)
          ? error.detail
          : "We couldn't copy the schema template."
      );
    } finally {
      setCopyPending(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-border bg-card/80 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow tone="brand" spacing="wide">
              {t("Schema templates")}
            </Eyebrow>
            <SectionHeading as="h1" size="xl" className="mt-3">
              {t("Create reusable schema blueprints.")}
            </SectionHeading>
            <p className="mt-2 max-w-2xl text-sm text-muted-strong">
              {t(
                "Save schema definitions as templates, then apply them when creating new collections."
              )}
            </p>
          </div>
          <Button
            variant="outline"
            className="w-10 px-0"
            onClick={refresh}
            aria-label={t("Refresh")}
            title={t("Refresh")}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="relative self-start">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
            <input
              type="search"
              placeholder={t("Search schema templates")}
              className="block h-11 w-full rounded-full border border-border bg-card pl-9 pr-3 text-sm text-muted-strong shadow-sm transition focus:border-brand-border focus:outline-none focus:ring-2 focus:ring-ring"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder={t("Template name")}
                className="h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 sm:flex-1 text-sm text-muted-strong shadow-sm transition focus:border-brand-border focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="button" className="h-11 shrink-0" onClick={handleCreate} disabled={isCreating}>
                <Plus className="h-4 w-4" />
                {isCreating ? t("Creating...") : t("Create template")}
              </Button>
            </div>
            {createError ? (
              <p className="text-xs text-destructive">{t(createError)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("Create a blank template, then add fields in the editor.")}
              </p>
            )}
          </div>
        </div>
      </header>

      {state.status === "loading" && state.data.length === 0 ? (
        <EmptyState
          aria-busy="true">
          {t("Loading schema templates...")}
        </EmptyState>
      ) : state.status === "error" && state.data.length === 0 ? (
        <Alert className="rounded-3xl p-6">
          {t(state.error ?? "We couldn't load your schema templates.")}
        </Alert>
      ) : state.data.length === 0 ? (
        <Card tone="subtle" padding="lg">
          <p className="text-sm font-medium text-muted-strong">
            {t("No schema templates found.")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("Create your first template to speed up new collection setup.")}
          </p>
          <div className="mt-6">
            <Button asChild variant="secondary">
              <Link href="/collections/new">{t("New collection")}</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {state.data.map((template) => (
            <article
              key={template.id}
              className="rounded-3xl border border-border bg-card/90 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Eyebrow tone="subtle" spacing="tight">
                    {t("Template")}
                  </Eyebrow>
                  <h2 className="mt-2 text-lg font-semibold text-foreground">
                    {template.name}
                  </h2>
                </div>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-strong">
                  {tc(template.field_count, "{count} field", "{count} fields")}
                </span>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {t("Updated {date}", {
                  date: formatDate(template.updated_at, locale)
                })}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/schema-templates/${template.id}`}>
                    <PencilLine className="h-4 w-4" />
                    {t("Edit schema")}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(template)}
                  disabled={copyPending !== null}
                >
                  <Copy className="h-4 w-4" />
                  {copyPending === template.id ? t("Copying...") : t("Copy")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(template)}
                  disabled={deletePending === template.id || copyPending !== null}
                >
                  <Trash2 className="h-4 w-4" />
                  {deletePending === template.id ? t("Deleting...") : t("Delete")}
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

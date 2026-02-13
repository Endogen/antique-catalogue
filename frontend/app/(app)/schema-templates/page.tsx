"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, PencilLine, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  isApiError,
  schemaTemplateApi,
  type SchemaTemplateSummaryResponse
} from "@/lib/api";

type TemplatesState = {
  status: "loading" | "ready" | "error";
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
  const { t, locale } = useI18n();
  const [query, setQuery] = React.useState("");
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [state, setState] = React.useState<TemplatesState>({
    status: "loading",
    data: []
  });
  const [templateName, setTemplateName] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState<number | null>(null);
  const [copyPending, setCopyPending] = React.useState<number | null>(null);

  React.useEffect(() => {
    let isActive = true;
    const handle = setTimeout(() => {
      void (async () => {
        setState((prev) => ({
          ...prev,
          status: "loading",
          error: undefined
        }));
        try {
          const data = await schemaTemplateApi.list({
            q: query.trim() || undefined,
            limit: 100
          });
          if (!isActive) {
            return;
          }
          setState({
            status: "ready",
            data
          });
        } catch (error) {
          if (!isActive) {
            return;
          }
          setState((prev) => ({
            status: "error",
            data: prev.data,
            error: isApiError(error)
              ? error.detail
              : "We couldn't load your schema templates."
          }));
        }
      })();
    }, 250);

    return () => {
      isActive = false;
      clearTimeout(handle);
    };
  }, [query, refreshToken]);

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
      setRefreshToken((prev) => prev + 1);
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
    const confirmed = window.confirm(
      t('Delete the "{name}" template? This cannot be undone.', {
        name: template.name
      })
    );
    if (!confirmed) {
      return;
    }

    setDeletePending(template.id);
    try {
      await schemaTemplateApi.delete(template.id);
      setState((prev) => ({
        ...prev,
        data: prev.data.filter((item) => item.id !== template.id)
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: isApiError(error)
          ? error.detail
          : "We couldn't delete the schema template."
      }));
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
      setState((prev) => ({
        ...prev,
        status: "error",
        error: isApiError(error)
          ? error.detail
          : "We couldn't copy the schema template."
      }));
    } finally {
      setCopyPending(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              {t("Schema templates")}
            </p>
            <h1 className="font-display mt-3 text-3xl text-stone-900">
              {t("Create reusable schema blueprints.")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-600">
              {t(
                "Save schema definitions as templates, then apply them when creating new collections."
              )}
            </p>
          </div>
          <Button variant="outline" onClick={() => setRefreshToken((prev) => prev + 1)}>
            <RefreshCcw className="h-4 w-4" />
            {t("Refresh")}
          </Button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              placeholder={t("Search schema templates")}
              className="h-11 w-full rounded-full border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-700 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder={t("Template name")}
                className="h-11 min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              <Button type="button" onClick={handleCreate} disabled={isCreating}>
                <Plus className="h-4 w-4" />
                {isCreating ? t("Creating...") : t("Create template")}
              </Button>
            </div>
            {createError ? (
              <p className="text-xs text-rose-600">{t(createError)}</p>
            ) : (
              <p className="text-xs text-stone-500">
                {t("Create a blank template, then add fields in the editor.")}
              </p>
            )}
          </div>
        </div>
      </header>

      {state.status === "loading" && state.data.length === 0 ? (
        <div
          className="rounded-3xl border border-dashed border-stone-200 bg-white/70 p-8 text-sm text-stone-500"
          aria-busy="true"
        >
          {t("Loading schema templates...")}
        </div>
      ) : state.status === "error" && state.data.length === 0 ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-6 text-sm text-rose-700">
          {t(state.error ?? "We couldn't load your schema templates.")}
        </div>
      ) : state.data.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-white/80 p-8">
          <p className="text-sm font-medium text-stone-700">
            {t("No schema templates found.")}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            {t("Create your first template to speed up new collection setup.")}
          </p>
          <div className="mt-6">
            <Button asChild variant="secondary">
              <Link href="/collections/new">{t("New collection")}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {state.data.map((template) => (
            <article
              key={template.id}
              className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                    {t("Template")}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-stone-900">
                    {template.name}
                  </h2>
                </div>
                <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-600">
                  {t("{count} fields", { count: template.field_count })}
                </span>
              </div>

              <p className="mt-3 text-xs text-stone-500">
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

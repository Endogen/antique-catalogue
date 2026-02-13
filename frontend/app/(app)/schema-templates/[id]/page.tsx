"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, RefreshCcw, Trash2 } from "lucide-react";

import { SchemaBuilder } from "@/components/schema-builder";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  isApiError,
  schemaTemplateApi,
  type FieldDefinitionCreatePayload,
  type FieldDefinitionUpdatePayload,
  type SchemaTemplateResponse
} from "@/lib/api";

type LoadState = {
  status: "loading" | "ready" | "error";
  data?: SchemaTemplateResponse;
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

export default function SchemaTemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useI18n();
  const templateId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  const [nameInput, setNameInput] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isCopying, setIsCopying] = React.useState(false);

  const loadTemplate = React.useCallback(async () => {
    if (!templateId) {
      setState({
        status: "error",
        error: "Schema template ID was not provided."
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));
    try {
      const data = await schemaTemplateApi.get(templateId);
      setState({
        status: "ready",
        data
      });
      setNameInput(data.name);
    } catch (error) {
      setState({
        status: "error",
        error: isApiError(error)
          ? error.detail
          : "We couldn't load this schema template."
      });
    }
  }, [templateId]);

  React.useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  const templateSchemaApi = React.useMemo(() => {
    if (!templateId) {
      return null;
    }
    return {
      list: () => schemaTemplateApi.listFields(templateId),
      create: (payload: FieldDefinitionCreatePayload) =>
        schemaTemplateApi.createField(templateId, payload),
      update: (fieldId: number, payload: FieldDefinitionUpdatePayload) =>
        schemaTemplateApi.updateField(templateId, fieldId, payload),
      delete: (fieldId: number) => schemaTemplateApi.deleteField(templateId, fieldId),
      reorder: (fieldIds: number[]) =>
        schemaTemplateApi.reorderFields(templateId, fieldIds)
    };
  }, [templateId]);

  const handleSaveName = async () => {
    if (!templateId || isSaving) {
      return;
    }

    const normalized = nameInput.trim();
    if (!normalized) {
      setFormError("Template name is required.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    setSaveMessage(null);
    try {
      const updated = await schemaTemplateApi.update(templateId, { name: normalized });
      setState({
        status: "ready",
        data: updated
      });
      setNameInput(updated.name);
      setSaveMessage("Template updated.");
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't save the schema template."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!templateId || !state.data || isDeleting) {
      return;
    }

    const confirmed = window.confirm(
      t('Delete the "{name}" template? This cannot be undone.', {
        name: state.data.name
      })
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setFormError(null);
    try {
      await schemaTemplateApi.delete(templateId);
      router.push("/schema-templates");
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't delete the schema template."
      );
      setIsDeleting(false);
    }
  };

  const handleCopy = async () => {
    if (!templateId || isCopying || isDeleting) {
      return;
    }
    setIsCopying(true);
    setFormError(null);
    try {
      const copied = await schemaTemplateApi.copy(templateId);
      router.push(`/schema-templates/${copied.id}`);
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't copy the schema template."
      );
      setIsCopying(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/schema-templates">
              <ArrowLeft className="h-4 w-4" />
              {t("Back to schema templates")}
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              {t("Schema template")}
            </p>
            <h1 className="font-display mt-4 text-3xl text-stone-900">
              {state.status === "ready" && state.data
                ? state.data.name
                : t("Template details")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-stone-600">
              {t(
                "Update this template and reuse it when creating future collections."
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => loadTemplate()}>
            <RefreshCcw className="h-4 w-4" />
            {t("Refresh")}
          </Button>
          <Button
            variant="ghost"
            onClick={handleCopy}
            disabled={isCopying || isDeleting}
          >
            <Copy className="h-4 w-4" />
            {isCopying ? t("Copying...") : t("Copy")}
          </Button>
          <Button variant="ghost" onClick={handleDelete} disabled={isDeleting}>
            <Trash2 className="h-4 w-4" />
            {isDeleting ? t("Deleting...") : t("Delete")}
          </Button>
        </div>
      </header>

      {state.status === "loading" ? (
        <div
          className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
          aria-busy="true"
        >
          {t("Loading schema template...")}
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
          <p className="text-sm font-medium text-rose-700">
            {t("We hit a snag loading this schema template.")}
          </p>
          <p className="mt-2 text-sm text-rose-600">
            {t(state.error ?? "Please try again.")}
          </p>
          <div className="mt-4">
            <Button variant="outline" onClick={() => loadTemplate()}>
              {t("Try again")}
            </Button>
          </div>
        </div>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                {t("Template details")}
              </p>
              <h2 className="font-display mt-3 text-2xl text-stone-900">
                {t("Manage template identity.")}
              </h2>
              <p className="mt-3 text-sm text-stone-600">
                {t("Template names are searchable during collection creation.")}
              </p>

              {formError ? (
                <div
                  role="alert"
                  className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                  {t(formError)}
                </div>
              ) : null}

              {saveMessage ? (
                <div
                  role="status"
                  className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  {t(saveMessage)}
                </div>
              ) : null}

              <div className="mt-6 space-y-3">
                <label className="text-sm font-medium text-stone-700" htmlFor="template-name">
                  {t("Template name")}
                </label>
                <input
                  id="template-name"
                  type="text"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div className="mt-6">
                <Button onClick={handleSaveName} disabled={isSaving}>
                  {isSaving ? t("Saving changes...") : t("Save changes")}
                </Button>
              </div>
            </div>

            {templateSchemaApi ? <SchemaBuilder api={templateSchemaApi} /> : null}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                {t("Template snapshot")}
              </p>
              <h3 className="font-display mt-3 text-2xl text-stone-900">
                {t("Quick details")}
              </h3>
              <div className="mt-6 space-y-2 text-sm text-stone-600">
                <p>
                  {t("{count} fields", {
                    count: state.data?.field_count ?? 0
                  })}
                </p>
                <p>
                  {t("Created {date}", {
                    date: formatDate(state.data?.created_at, locale)
                  })}
                </p>
                <p>
                  {t("Updated {date}", {
                    date: formatDate(state.data?.updated_at, locale)
                  })}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-900/90 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-6 text-stone-100 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                {t("Template behavior")}
              </p>
              <p className="mt-3 text-sm text-stone-300">
                {t(
                  "Collections created from this template get a copy of these fields. Future template edits do not change existing collections."
                )}
              </p>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}

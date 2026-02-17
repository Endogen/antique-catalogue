"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Globe2,
  Lock,
  RefreshCcw,
  Search,
  Settings2
} from "lucide-react";

import {
  CollectionForm,
  type CollectionFormValues
} from "@/components/collection-form";
import { SchemaBuilder } from "@/components/schema-builder";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  collectionApi,
  fieldApi,
  isApiError,
  schemaTemplateApi,
  type CollectionResponse,
  type SchemaTemplateSummaryResponse
} from "@/lib/api";
import { cn } from "@/lib/utils";

const buildPayload = (values: CollectionFormValues) => ({
  name: values.name.trim(),
  description: values.description.trim() ? values.description.trim() : null,
  is_public: values.is_public
});

type LoadState = {
  status: "loading" | "ready" | "error";
  data?: CollectionResponse;
  error?: string;
};

export default function CollectionSettingsPage() {
  const params = useParams();
  const { t, locale } = useI18n();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [state, setState] = React.useState<LoadState>({
    status: "loading"
  });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [templateName, setTemplateName] = React.useState("");
  const [templateError, setTemplateError] = React.useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = React.useState<string | null>(null);
  const [savedTemplateId, setSavedTemplateId] = React.useState<number | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = React.useState(false);
  const [schemaBuilderKey, setSchemaBuilderKey] = React.useState(0);
  const [applyTemplateQuery, setApplyTemplateQuery] = React.useState("");
  const [selectedApplyTemplateId, setSelectedApplyTemplateId] = React.useState<
    number | null
  >(null);
  const [applyTemplatesState, setApplyTemplatesState] = React.useState<{
    status: "idle" | "loading" | "ready" | "error";
    data: SchemaTemplateSummaryResponse[];
    error?: string;
  }>({
    status: "idle",
    data: []
  });
  const [applyTemplateError, setApplyTemplateError] = React.useState<string | null>(
    null
  );
  const [applyTemplateMessage, setApplyTemplateMessage] = React.useState<
    string | null
  >(null);
  const [isApplyingTemplate, setIsApplyingTemplate] = React.useState(false);

  const formatDate = React.useCallback(
    (value?: string | null) => {
      if (!value) {
        return "—";
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
    },
    [locale]
  );

  const loadCollection = React.useCallback(async () => {
    if (!collectionId) {
      setState({
        status: "error",
        error: "Collection ID was not provided."
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));

    try {
      const data = await collectionApi.get(collectionId);
      setState({
        status: "ready",
        data
      });
    } catch (error) {
      setState({
        status: "error",
        error: isApiError(error)
          ? error.detail
          : "We couldn't load this collection."
      });
    }
  }, [collectionId]);

  React.useEffect(() => {
    void loadCollection();
  }, [loadCollection]);

  React.useEffect(() => {
    if (!collectionId) {
      return;
    }
    let isActive = true;
    const handle = setTimeout(() => {
      void (async () => {
        setApplyTemplatesState((prev) => ({
          ...prev,
          status: "loading",
          error: undefined
        }));
        try {
          const data = await schemaTemplateApi.list({
            q: applyTemplateQuery.trim() || undefined,
            limit: 50
          });
          if (!isActive) {
            return;
          }
          setApplyTemplatesState({
            status: "ready",
            data
          });
          setSelectedApplyTemplateId((prev) =>
            prev !== null && data.some((template) => template.id === prev)
              ? prev
              : null
          );
        } catch (error) {
          if (!isActive) {
            return;
          }
          setApplyTemplatesState((prev) => ({
            ...prev,
            status: "error",
            error: isApiError(error)
              ? error.detail
              : "We couldn't load schema templates."
          }));
        }
      })();
    }, 250);

    return () => {
      isActive = false;
      clearTimeout(handle);
    };
  }, [applyTemplateQuery, collectionId]);

  const handleSubmit = async (values: CollectionFormValues) => {
    if (!collectionId) {
      return;
    }
    setFormError(null);
    setSaveMessage(null);
    try {
      const updated = await collectionApi.update(
        collectionId,
        buildPayload(values)
      );
      setState({
        status: "ready",
        data: updated
      });
      setSaveMessage("Changes saved successfully.");
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't save changes. Please try again."
      );
    }
  };

  const handleSaveSchemaTemplate = async () => {
    if (!collectionId || isSavingTemplate) {
      return;
    }
    const normalizedName = templateName.trim();
    if (!normalizedName) {
      setTemplateError("Template name is required.");
      return;
    }

    setTemplateError(null);
    setTemplateMessage(null);
    setSavedTemplateId(null);
    setIsSavingTemplate(true);
    try {
      const fields = await fieldApi.list(collectionId);
      const created = await schemaTemplateApi.create({
        name: normalizedName,
        fields: fields.map((field) => ({
          name: field.name,
          field_type: field.field_type,
          is_required: field.is_required,
          is_private: field.is_private,
          options: field.options
        }))
      });
      setTemplateName("");
      setSavedTemplateId(created.id);
      setTemplateMessage("Schema template saved.");
    } catch (error) {
      setTemplateError(
        isApiError(error)
          ? error.detail
          : "We couldn't save the schema template."
      );
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleApplySchemaTemplate = async () => {
    if (!collectionId || isApplyingTemplate) {
      return;
    }
    if (!selectedApplyTemplateId) {
      setApplyTemplateError("Select a schema template to apply.");
      return;
    }

    setApplyTemplateError(null);
    setApplyTemplateMessage(null);
    setIsApplyingTemplate(true);
    try {
      const result = await collectionApi.applyTemplate(collectionId, {
        schema_template_id: selectedApplyTemplateId
      });
      setApplyTemplateMessage(result.message);
      setSchemaBuilderKey((prev) => prev + 1);
    } catch (error) {
      setApplyTemplateError(
        isApiError(error)
          ? error.detail
          : "We couldn't apply the schema template."
      );
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/collections">
              <ArrowLeft className="h-4 w-4" />
              {t("Back to collections")}
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              {t("Collection settings")}
            </p>
            <h1 className="font-display mt-4 text-3xl text-stone-900">
              {state.status === "ready" && state.data
                ? state.data.name
                : t("Review collection details")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-stone-600">
              {t(
                "Update the collection name, description, and public visibility."
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => loadCollection()}>
            <RefreshCcw className="h-4 w-4" />
            {t("Refresh")}
          </Button>
        </div>
      </header>

      {state.status === "loading" ? (
        <div
          className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
          aria-busy="true"
        >
          {t("Loading collection settings...")}
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
          <p className="text-sm font-medium text-rose-700">
            {t("We hit a snag loading this collection.")}
          </p>
          <p className="mt-2 text-sm text-rose-600">
            {t(state.error ?? "Please try again.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => loadCollection()}>
              {t("Try again")}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/collections">{t("Back to collections")}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                {t("Collection details")}
              </p>
              <h2 className="font-display mt-3 text-2xl text-stone-900">
                {t("Keep your catalogue organized.")}
              </h2>
              <p className="mt-3 text-sm text-stone-600">
                {t(
                  "These details appear throughout your workspace and in the public directory if enabled."
                )}
              </p>

              {saveMessage ? (
                <div
                  role="status"
                  className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  {t(saveMessage)}
                </div>
              ) : null}

              <div className="mt-6">
                <CollectionForm
                  initialValues={{
                    name: state.data?.name ?? "",
                    description: state.data?.description ?? "",
                    is_public: state.data?.is_public ?? false
                  }}
                  onSubmit={handleSubmit}
                  submitLabel={t("Save changes")}
                  submitPendingLabel={t("Saving changes...")}
                  secondaryAction={
                    <Button variant="ghost" type="button" asChild>
                      <Link href="/collections">{t("Back to collections")}</Link>
                    </Button>
                  }
                  formError={formError}
                />
              </div>
            </div>

            <SchemaBuilder key={schemaBuilderKey} collectionId={collectionId ?? ""} />
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                {t("Collection snapshot")}
              </p>
              <h3 className="font-display mt-3 text-2xl text-stone-900">
                {t("Quick details")}
              </h3>
              <div className="mt-6 space-y-4 text-sm text-stone-600">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">{t("Created")}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatDate(state.data?.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                    <Settings2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">
                      {t("Last updated")}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatDate(state.data?.updated_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    {state.data?.is_public ? (
                      <Globe2 className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">{t("Visibility")}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {state.data?.is_public
                        ? t("Public directory")
                        : t("Private workspace")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                {t("Apply schema template")}
              </p>
              <h3 className="font-display mt-3 text-2xl text-stone-900">
                {t("Copy fields from a saved schema template.")}
              </h3>
              <p className="mt-3 text-sm text-stone-600">
                {t(
                  "Append fields from one of your saved templates to this collection schema."
                )}
              </p>

              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    type="search"
                    value={applyTemplateQuery}
                    onChange={(event) => setApplyTemplateQuery(event.target.value)}
                    placeholder={t("Search schema templates")}
                    className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-700 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>

                {applyTemplatesState.status === "loading" &&
                applyTemplatesState.data.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    {t("Loading schema templates...")}
                  </p>
                ) : applyTemplatesState.status === "error" ? (
                  <p className="text-xs text-rose-600">
                    {t(
                      applyTemplatesState.error ??
                        "We couldn't load schema templates."
                    )}
                  </p>
                ) : applyTemplatesState.data.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    {t("No schema templates found.")}
                  </p>
                ) : (
                  <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {applyTemplatesState.data.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          setSelectedApplyTemplateId(template.id);
                          setApplyTemplateError(null);
                          setApplyTemplateMessage(null);
                        }}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition",
                          selectedApplyTemplateId === template.id
                            ? "border-amber-300 bg-amber-50/80"
                            : "border-stone-200 bg-white hover:border-stone-300"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-stone-900">
                            {template.name}
                          </p>
                          <span className="text-xs text-stone-500">
                            {t("{count} fields", { count: template.field_count })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleApplySchemaTemplate}
                  disabled={isApplyingTemplate || !selectedApplyTemplateId}
                >
                  {isApplyingTemplate ? t("Applying...") : t("Apply template")}
                </Button>

                {applyTemplateError ? (
                  <p className="text-xs text-rose-600">{t(applyTemplateError)}</p>
                ) : null}
                {applyTemplateMessage ? (
                  <p className="text-xs text-emerald-700">
                    {t(applyTemplateMessage)}
                  </p>
                ) : null}

                <p className="text-xs text-stone-500">
                  {t("Need a new template?")}{" "}
                  <Link
                    href="/schema-templates"
                    className="font-medium text-amber-700"
                  >
                    {t("Manage schema templates")}
                  </Link>
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                {t("Save schema template")}
              </p>
              <h3 className="font-display mt-3 text-2xl text-stone-900">
                {t("Reuse this schema later.")}
              </h3>
              <p className="mt-3 text-sm text-stone-600">
                {t(
                  "Save the current field setup as a template for future collections."
                )}
              </p>
              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder={t("Template name")}
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
                <Button
                  type="button"
                  onClick={handleSaveSchemaTemplate}
                  disabled={isSavingTemplate}
                >
                  {isSavingTemplate ? t("Saving...") : t("Save template")}
                </Button>
                {templateError ? (
                  <p className="text-xs text-rose-600">{t(templateError)}</p>
                ) : null}
                {templateMessage ? (
                  <p className="text-xs text-emerald-700">
                    {t(templateMessage)}{" "}
                    {savedTemplateId ? (
                      <Link
                        href={`/schema-templates/${savedTemplateId}`}
                        className="font-medium text-emerald-700 underline"
                      >
                        {t("Open")}
                      </Link>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-stone-900/90 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-6 text-stone-100 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                {t("Next step")}
              </p>
              <p className="mt-3 text-sm text-stone-300">
                {t(
                  "Define the metadata fields for this collection to begin adding items in the next step."
                )}
              </p>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}

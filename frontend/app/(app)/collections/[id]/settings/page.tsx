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
  Settings2,
  ShieldAlert,
  Trash2
} from "lucide-react";

import {
  CollectionForm,
  type CollectionFormValues
} from "@/components/collection-form";
import { SchemaBuilder } from "@/components/schema-builder";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  collectionApi,
  fieldApi,
  isApiError,
  schemaTemplateApi,
  type CollectionResponse,
  type SchemaTemplateSummaryResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";
import { Card, EmptyState } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

const DELETE_TOKEN = "DELETE";

type DeleteState = {
  status: "idle" | "working" | "error";
  message?: string;
};

const buildPayload = (values: CollectionFormValues) => ({
  name: values.name.trim(),
  description: values.description.trim() ? values.description.trim() : null,
  is_public: values.is_public
});

export default function CollectionSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { t, tc, locale } = useI18n();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [deletePhrase, setDeletePhrase] = React.useState("");
  const [deleteState, setDeleteState] = React.useState<DeleteState>({
    status: "idle"
  });
  const confirmDeleteMatches = deletePhrase.trim().toUpperCase() === DELETE_TOKEN;
  const queryClient = useQueryClient();
  const collectionKey = queryKeys.collections.detail(Number(collectionId));
  const collectionQuery = useQuery({
    queryKey: collectionKey,
    queryFn: ({ signal }) => collectionApi.get(collectionId!, { signal }),
    enabled: Boolean(collectionId)
  });
  const state = toLoadState<CollectionResponse | undefined>(
    collectionQuery,
    "We couldn't load this collection.",
    undefined
  );
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

  const { refetch: refetchCollection } = collectionQuery;
  const loadCollection = React.useCallback(() => {
    void refetchCollection();
  }, [refetchCollection]);


  const debouncedTemplateQuery = useDebouncedValue(applyTemplateQuery).trim();
  const applyTemplatesQuery = useQuery({
    queryKey: [
      ...queryKeys.schemaTemplates.list(),
      "apply",
      debouncedTemplateQuery
    ],
    queryFn: ({ signal }) =>
      schemaTemplateApi.list({
        q: debouncedTemplateQuery || undefined,
        limit: 50,
        signal
      }),
    enabled: Boolean(collectionId)
  });
  const applyTemplatesState = toLoadState<SchemaTemplateSummaryResponse[]>(
    applyTemplatesQuery,
    "We couldn't load schema templates.",
    []
  );

  // Clear a selection that the latest search no longer contains.
  const availableTemplates = applyTemplatesQuery.data;
  React.useEffect(() => {
    if (!availableTemplates) {
      return;
    }
    setSelectedApplyTemplateId((prev) =>
      prev !== null && availableTemplates.some((template) => template.id === prev)
        ? prev
        : null
    );
  }, [availableTemplates]);


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
      queryClient.setQueryData(collectionKey, updated);
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

  const handleDeleteCollection = async () => {
    if (!collectionId || deleteState.status === "working") {
      return;
    }

    setDeleteState({ status: "working" });
    try {
      await collectionApi.delete(collectionId);
      router.push("/collections");
    } catch (error) {
      setDeleteState({
        status: "error",
        message: isApiError(error)
          ? error.detail
          : "Unable to delete collection."
      });
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
            <Eyebrow tone="brand" spacing="wide">
              {t("Collection settings")}
            </Eyebrow>
            <SectionHeading as="h1" size="xl" className="mt-4">
              {state.status === "ready" && state.data
                ? state.data.name
                : t("Review collection details")}
            </SectionHeading>
            <p className="mt-3 max-w-2xl text-sm text-muted-strong">
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
        <EmptyState
          aria-busy="true">
          {t("Loading collection settings...")}
        </EmptyState>
      ) : state.status === "error" ? (
        <Alert className="rounded-3xl p-6">
          <p className="text-sm font-medium text-destructive">
            {t("We hit a snag loading this collection.")}
          </p>
          <p className="mt-2 text-sm text-destructive">
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
        </Alert>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Card>
              <Eyebrow>
                {t("Collection details")}
              </Eyebrow>
              <SectionHeading className="mt-3">
                {t("Keep your catalogue organized.")}
              </SectionHeading>
              <p className="mt-3 text-sm text-muted-strong">
                {t(
                  "These details appear throughout your workspace and in the public directory if enabled."
                )}
              </p>

              {saveMessage ? (
                <Alert tone="success"
                  role="status"
                  className="mt-6">
                  {t(saveMessage)}
                </Alert>
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
            </Card>

            <SchemaBuilder key={`${collectionId}:${schemaBuilderKey}`} collectionId={collectionId ?? ""} />
          </div>

          <aside className="space-y-6">
            <Card tone="subtle">
              <Eyebrow>
                {t("Collection snapshot")}
              </Eyebrow>
              <SectionHeading as="h3" className="mt-3">
                {t("Quick details")}
              </SectionHeading>
              <div className="mt-6 space-y-4 text-sm text-muted-strong">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{t("Created")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(state.data?.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                    <Settings2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {t("Last updated")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(state.data?.updated_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                    {state.data?.is_public ? (
                      <Globe2 className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{t("Visibility")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state.data?.is_public
                        ? t("Public directory")
                        : t("Private workspace")}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card tone="subtle">
              <Eyebrow>
                {t("Apply schema template")}
              </Eyebrow>
              <SectionHeading as="h3" className="mt-3">
                {t("Copy fields from a saved schema template.")}
              </SectionHeading>
              <p className="mt-3 text-sm text-muted-strong">
                {t(
                  "Append fields from one of your saved templates to this collection schema."
                )}
              </p>

              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
                  <input
                    type="search"
                    value={applyTemplateQuery}
                    onChange={(event) => setApplyTemplateQuery(event.target.value)}
                    placeholder={t("Search schema templates")}
                    className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-muted-strong shadow-sm transition focus:border-brand-border focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {applyTemplatesState.status === "loading" &&
                applyTemplatesState.data.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("Loading schema templates...")}
                  </p>
                ) : applyTemplatesState.status === "error" ? (
                  <p className="text-xs text-destructive">
                    {t(
                      applyTemplatesState.error ??
                        "We couldn't load schema templates."
                    )}
                  </p>
                ) : applyTemplatesState.data.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
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
                            ? "border-brand-border bg-brand-muted/80"
                            : "border-border bg-card hover:border-muted-subtle"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {template.name}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {tc(template.field_count, "{count} field", "{count} fields")}
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
                  <p className="text-xs text-destructive">{t(applyTemplateError)}</p>
                ) : null}
                {applyTemplateMessage ? (
                  <p className="text-xs text-success">
                    {t(applyTemplateMessage)}
                  </p>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  {t("Need a new template?")}{" "}
                  <Link
                    href="/schema-templates"
                    className="font-medium text-brand"
                  >
                    {t("Manage schema templates")}
                  </Link>
                </p>
              </div>
            </Card>

            <Card tone="subtle">
              <Eyebrow>
                {t("Save schema template")}
              </Eyebrow>
              <SectionHeading as="h3" className="mt-3">
                {t("Reuse this schema later.")}
              </SectionHeading>
              <p className="mt-3 text-sm text-muted-strong">
                {t(
                  "Save the current field setup as a template for future collections."
                )}
              </p>
              <div className="mt-4 space-y-3">
                <Input
                  type="text"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder={t("Template name")}

                />
                <Button
                  type="button"
                  onClick={handleSaveSchemaTemplate}
                  disabled={isSavingTemplate}
                >
                  {isSavingTemplate ? t("Saving...") : t("Save template")}
                </Button>
                {templateError ? (
                  <p className="text-xs text-destructive">{t(templateError)}</p>
                ) : null}
                {templateMessage ? (
                  <p className="text-xs text-success">
                    {t(templateMessage)}{" "}
                    {savedTemplateId ? (
                      <Link
                        href={`/schema-templates/${savedTemplateId}`}
                        className="font-medium text-success underline"
                      >
                        {t("Open")}
                      </Link>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </Card>

            <div className="rounded-3xl border border-panel-border/90 surface-panel p-6 text-panel-foreground shadow-sm">
              <Eyebrow tone="subtle">
                {t("Next step")}
              </Eyebrow>
              <p className="mt-3 text-sm text-panel-muted-foreground">
                {t(
                  "Define the metadata fields for this collection to begin adding items in the next step."
                )}
              </p>
            </div>

            <Alert className="rounded-3xl p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Eyebrow className="text-destructive">
                    {t("Danger zone")}
                  </Eyebrow>
                  <SectionHeading as="h3" className="mt-3">
                    {t("Permanently delete this collection.")}
                  </SectionHeading>
                  <p className="mt-3 text-sm text-destructive">
                    {t(
                      "This removes the collection, all its items, and any attached imagery. Type {token} to confirm.",
                      { token: DELETE_TOKEN }
                    )}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive-muted text-destructive">
                  <ShieldAlert className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <div>
                  <label
                    className="text-sm font-medium text-destructive"
                    htmlFor="delete-collection-confirm"
                  >
                    {t("Confirmation phrase")}
                  </label>
                  <input
                    id="delete-collection-confirm"
                    type="text"
                    className="mt-2 w-full rounded-xl border border-destructive-border bg-card px-4 py-3 text-sm text-foreground shadow-sm transition focus:border-destructive-border focus:outline-none focus:ring-2 focus:ring-destructive-border"
                    value={deletePhrase}
                    onChange={(event) => setDeletePhrase(event.target.value)}
                    placeholder={t("Type {token} to confirm", { token: DELETE_TOKEN })}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive-border text-destructive hover:bg-destructive-muted"
                  disabled={!confirmDeleteMatches || deleteState.status === "working"}
                  onClick={handleDeleteCollection}
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteState.status === "working"
                    ? t("Deleting...")
                    : t("Delete collection")}
                </Button>
              </div>

              {deleteState.status === "error" && deleteState.message ? (
                <Alert
                  role="alert"
                  className="mt-4 bg-card/80">
                  {t(deleteState.message)}
                </Alert>
              ) : null}
            </Alert>
          </aside>
        </section>
      )}
    </div>
  );
}

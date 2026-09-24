"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, RefreshCcw, Trash2 } from "lucide-react";

import { SchemaBuilder } from "@/components/schema-builder";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  isApiError,
  schemaTemplateApi,
  type FieldDefinitionCreatePayload,
  type FieldDefinitionUpdatePayload,
  type SchemaTemplateResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { Card, EmptyState } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

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
  const { t, tc, locale } = useI18n();
  const confirm = useConfirm();
  const templateId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const queryClient = useQueryClient();
  const templateKey = queryKeys.schemaTemplates.detail(Number(templateId));
  const templateQuery = useQuery({
    queryKey: templateKey,
    queryFn: ({ signal }) => schemaTemplateApi.get(templateId!, { signal }),
    enabled: Boolean(templateId)
  });
  const state = toLoadState<SchemaTemplateResponse | undefined>(
    templateQuery,
    "We couldn't load this schema template.",
    undefined
  );
  const [nameInput, setNameInput] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isCopying, setIsCopying] = React.useState(false);

  const { refetch: refetchTemplate } = templateQuery;
  const loadTemplate = React.useCallback(() => {
    void refetchTemplate();
  }, [refetchTemplate]);

  // Mirror the loaded name into the editable field.
  const loadedName = templateQuery.data?.name;
  React.useEffect(() => {
    if (loadedName) {
      setNameInput(loadedName);
    }
  }, [loadedName]);


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
      queryClient.setQueryData(templateKey, updated);
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

    const confirmed = await confirm({
      title: t('Delete the "{name}" template? This cannot be undone.', {
        name: state.data.name
      }),
      confirmLabel: t("Delete"),
      tone: "destructive"
    });
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
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link href="/schema-templates">
              <ArrowLeft className="h-4 w-4" />
              {t("Back to schema templates")}
            </Link>
          </Button>
          <div>
            <Eyebrow tone="brand" spacing="wide">
              {t("Schema template")}
            </Eyebrow>
            <SectionHeading as="h1" size="xl" className="mt-4">
              {state.status === "ready" && state.data
                ? state.data.name
                : t("Template details")}
            </SectionHeading>
            <p className="mt-3 max-w-2xl text-sm text-muted-strong">
              {t(
                "Update this template and reuse it when creating future collections."
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="w-10 px-0"
            onClick={() => loadTemplate()}
            aria-label={t("Refresh")}
            title={t("Refresh")}
          >
            <RefreshCcw className="h-4 w-4" />
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
        <EmptyState
          aria-busy="true">
          {t("Loading schema template...")}
        </EmptyState>
      ) : state.status === "error" ? (
        <Alert className="rounded-3xl p-6">
          <p className="text-sm font-medium text-destructive">
            {t("We hit a snag loading this schema template.")}
          </p>
          <p className="mt-2 text-sm text-destructive">
            {t(state.error ?? "Please try again.")}
          </p>
          <div className="mt-4">
            <Button variant="outline" onClick={() => loadTemplate()}>
              {t("Try again")}
            </Button>
          </div>
        </Alert>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Card>
              <Eyebrow>
                {t("Template details")}
              </Eyebrow>
              <SectionHeading className="mt-3">
                {t("Manage template identity.")}
              </SectionHeading>
              <p className="mt-3 text-sm text-muted-strong">
                {t("Template names are searchable during collection creation.")}
              </p>

              {formError ? (
                <Alert
                  role="alert"
                  className="mt-6">
                  {t(formError)}
                </Alert>
              ) : null}

              {saveMessage ? (
                <Alert tone="success"
                  role="status"
                  className="mt-6">
                  {t(saveMessage)}
                </Alert>
              ) : null}

              <div className="mt-6 space-y-3">
                <label className="text-sm font-medium text-muted-strong" htmlFor="template-name">
                  {t("Template name")}
                </label>
                <Input
                  id="template-name"
                  type="text"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}

                />
              </div>

              <div className="mt-6">
                <Button onClick={handleSaveName} disabled={isSaving}>
                  {isSaving ? t("Saving changes...") : t("Save changes")}
                </Button>
              </div>
            </Card>

            {templateSchemaApi ? (
              <SchemaBuilder
                key={`template:${templateId}`}
                api={templateSchemaApi}
                sourceKey={`template:${templateId}`}
              />
            ) : null}
          </div>

          <aside className="space-y-6">
            <Card tone="subtle">
              <Eyebrow>
                {t("Template snapshot")}
              </Eyebrow>
              <SectionHeading as="h3" className="mt-3">
                {t("Quick details")}
              </SectionHeading>
              <div className="mt-6 space-y-2 text-sm text-muted-strong">
                <p>
                  {tc(state.data?.field_count ?? 0, "{count} field", "{count} fields")}
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
            </Card>

            <div className="rounded-3xl border border-panel-border/90 surface-panel p-6 text-panel-foreground shadow-sm">
              <Eyebrow tone="panel">
                {t("Template behavior")}
              </Eyebrow>
              <p className="mt-3 text-sm text-panel-muted-foreground">
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

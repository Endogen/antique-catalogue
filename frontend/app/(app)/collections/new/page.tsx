"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, FolderPlus, Search, Sparkles } from "lucide-react";

import {
  CollectionForm,
  type CollectionFormValues
} from "@/components/collection-form";
import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  collectionApi,
  isApiError,
  schemaTemplateApi,
  type SchemaTemplateSummaryResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";

const buildPayload = (
  values: CollectionFormValues,
  schemaTemplateId: number | null
) => ({
  name: values.name.trim(),
  description: values.description.trim() ? values.description.trim() : null,
  is_public: values.is_public,
  schema_template_id: schemaTemplateId
});

export default function NewCollectionPage() {
  const router = useRouter();
  const { t, tc } = useI18n();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [schemaMode, setSchemaMode] = React.useState<"scratch" | "template">(
    "scratch"
  );
  const [templateQuery, setTemplateQuery] = React.useState("");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<
    number | null
  >(null);
  const term = useDebouncedValue(templateQuery).trim();
  const templatesQuery = useQuery({
    queryKey: [...queryKeys.schemaTemplates.list(), "picker", term],
    queryFn: ({ signal }) =>
      schemaTemplateApi.list({ q: term || undefined, limit: 50, signal }),
    enabled: schemaMode === "template"
  });
  const templatesState = toLoadState<SchemaTemplateSummaryResponse[]>(
    templatesQuery,
    "We couldn't load schema templates.",
    []
  );


  const handleSubmit = async (values: CollectionFormValues) => {
    setFormError(null);
    const templateId = schemaMode === "template" ? selectedTemplateId : null;
    if (schemaMode === "template" && !templateId) {
      setFormError("Select a schema template before creating the collection.");
      return;
    }
    try {
      const created = await collectionApi.create(buildPayload(values, templateId));
      router.push(`/collections/${created.id}/settings`);
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't create the collection. Please try again."
      );
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link href="/collections">
              <ArrowLeft className="h-4 w-4" />
              {t("Back to collections")}
            </Link>
          </Button>
          <div>
            <Eyebrow tone="brand" spacing="wide">
              {t("New collection")}
            </Eyebrow>
            <SectionHeading as="h1" size="xl" className="mt-4">
              {t("Design the foundation for your archive.")}
            </SectionHeading>
            <p className="mt-3 max-w-2xl text-sm text-muted-strong">
              {t(
                "Give the collection a clear name, describe what belongs in it, and decide whether it is visible in the public directory."
              )}
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <Eyebrow>
            {t("Collection details")}
          </Eyebrow>
          <SectionHeading className="mt-3">
            {t("Capture the story you want to document.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-strong">
            {t("You can adjust the details later, including public visibility.")}
          </p>

          <div className="mt-6 rounded-2xl border border-border bg-background/80 p-4">
            <Eyebrow className="tracking-[0.25em]">
              {t("Schema setup")}
            </Eyebrow>
            <p className="mt-2 text-sm text-muted-strong">
              {t(
                "Choose whether to start with a blank schema or copy an existing template."
              )}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={cn(
                  "rounded-2xl border p-4 text-left text-sm transition",
                  schemaMode === "scratch"
                    ? "border-brand-border bg-brand-muted/80 text-foreground"
                    : "border-border bg-card text-muted-strong hover:border-muted-subtle"
                )}
                onClick={() => {
                  setSchemaMode("scratch");
                  setFormError(null);
                }}
              >
                <p className="font-medium text-foreground">
                  {t("Start from scratch")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Define fields manually after collection creation.")}
                </p>
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-2xl border p-4 text-left text-sm transition",
                  schemaMode === "template"
                    ? "border-brand-border bg-brand-muted/80 text-foreground"
                    : "border-border bg-card text-muted-strong hover:border-muted-subtle"
                )}
                onClick={() => {
                  setSchemaMode("template");
                  setFormError(null);
                }}
              >
                <p className="font-medium text-foreground">{t("Use template")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("Copy fields from a saved schema template.")}
                </p>
              </button>
            </div>

            {schemaMode === "template" ? (
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
                  <input
                    type="search"
                    value={templateQuery}
                    onChange={(event) => setTemplateQuery(event.target.value)}
                    placeholder={t("Search schema templates")}
                    className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-muted-strong shadow-xs transition focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring"
                  />
                </div>

                {templatesState.status === "loading" && templatesState.data.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("Loading schema templates...")}
                  </p>
                ) : templatesState.status === "error" ? (
                  <p className="text-xs text-destructive">
                    {t(
                      templatesState.error ?? "We couldn't load schema templates."
                    )}
                  </p>
                ) : templatesState.data.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("No schema templates found.")}
                  </p>
                ) : (
                  <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {templatesState.data.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition",
                          selectedTemplateId === template.id
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

                <p className="text-xs text-muted-foreground">
                  {t("Need a new template?")}
                  {" "}
                  <Link href="/schema-templates" className="font-medium text-brand">
                    {t("Manage schema templates")}
                  </Link>
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6">
            <CollectionForm
              onSubmit={handleSubmit}
              submitLabel={t("Create collection")}
              submitPendingLabel={t("Creating collection...")}
              secondaryAction={
                <Button variant="ghost" type="button" asChild>
                  <Link href="/collections">{t("Cancel")}</Link>
                </Button>
              }
              formError={formError}
            />
          </div>
        </Card>

        <aside className="space-y-6">
          <Card tone="subtle">
            <Eyebrow>
              {t("What happens next")}
            </Eyebrow>
            <SectionHeading as="h3" className="mt-3">
              {t("Build your schema and start cataloguing.")}
            </SectionHeading>
            <p className="mt-3 text-sm text-muted-strong">
              {t(
                "After creating the collection, define metadata fields, then add items and images from any device."
              )}
            </p>
            <div className="mt-6 space-y-4 text-sm text-muted-strong">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                  <FolderPlus className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{t("Define fields")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Set up condition, era, provenance, and more.")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{t("Capture imagery")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Upload photos or use the mobile camera capture button.")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-success-muted text-success">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{t("Share publicly")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Publish the collection when you are ready.")}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="rounded-3xl border border-panel-border/90 surface-panel p-6 text-panel-foreground shadow-xs">
            <Eyebrow tone="panel">
              {t("Studio note")}
            </Eyebrow>
            <p className="mt-3 text-sm text-panel-muted-foreground">
              {t(
                "Start with a simple collection and expand its schema once you see how you want to capture details."
              )}
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

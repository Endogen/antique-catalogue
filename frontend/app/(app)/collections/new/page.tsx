"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, FolderPlus, Search, Sparkles } from "lucide-react";

import {
  CollectionForm,
  type CollectionFormValues
} from "@/components/collection-form";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  collectionApi,
  isApiError,
  schemaTemplateApi,
  type SchemaTemplateSummaryResponse
} from "@/lib/api";
import { cn } from "@/lib/utils";

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
  const { t } = useI18n();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [schemaMode, setSchemaMode] = React.useState<"scratch" | "template">(
    "scratch"
  );
  const [templateQuery, setTemplateQuery] = React.useState("");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<
    number | null
  >(null);
  const [templatesState, setTemplatesState] = React.useState<{
    status: "idle" | "loading" | "ready" | "error";
    data: SchemaTemplateSummaryResponse[];
    error?: string;
  }>({
    status: "idle",
    data: []
  });

  React.useEffect(() => {
    if (schemaMode !== "template") {
      return;
    }
    let isActive = true;
    const handle = setTimeout(() => {
      void (async () => {
        setTemplatesState((prev) => ({
          ...prev,
          status: "loading",
          error: undefined
        }));
        try {
          const data = await schemaTemplateApi.list({
            q: templateQuery.trim() || undefined,
            limit: 50
          });
          if (!isActive) {
            return;
          }
          setTemplatesState({
            status: "ready",
            data
          });
        } catch (error) {
          if (!isActive) {
            return;
          }
          setTemplatesState((prev) => ({
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
  }, [schemaMode, templateQuery]);

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
          <Button variant="ghost" size="sm" asChild>
            <Link href="/collections">
              <ArrowLeft className="h-4 w-4" />
              {t("Back to collections")}
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              {t("New collection")}
            </p>
            <h1 className="font-display mt-4 text-3xl text-stone-900">
              {t("Design the foundation for your archive.")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-stone-600">
              {t(
                "Give the collection a clear name, describe what belongs in it, and decide whether it is visible in the public directory."
              )}
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            {t("Collection details")}
          </p>
          <h2 className="font-display mt-3 text-2xl text-stone-900">
            {t("Capture the story you want to document.")}
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            {t("You can adjust the details later, including public visibility.")}
          </p>

          <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">
              {t("Schema setup")}
            </p>
            <p className="mt-2 text-sm text-stone-600">
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
                    ? "border-amber-200 bg-amber-50/80 text-stone-900"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                )}
                onClick={() => {
                  setSchemaMode("scratch");
                  setFormError(null);
                }}
              >
                <p className="font-medium text-stone-900">
                  {t("Start from scratch")}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {t("Define fields manually after collection creation.")}
                </p>
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-2xl border p-4 text-left text-sm transition",
                  schemaMode === "template"
                    ? "border-amber-200 bg-amber-50/80 text-stone-900"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                )}
                onClick={() => {
                  setSchemaMode("template");
                  setFormError(null);
                }}
              >
                <p className="font-medium text-stone-900">{t("Use template")}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {t("Copy fields from a saved schema template.")}
                </p>
              </button>
            </div>

            {schemaMode === "template" ? (
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    type="search"
                    value={templateQuery}
                    onChange={(event) => setTemplateQuery(event.target.value)}
                    placeholder={t("Search schema templates")}
                    className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-700 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>

                {templatesState.status === "loading" && templatesState.data.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    {t("Loading schema templates...")}
                  </p>
                ) : templatesState.status === "error" ? (
                  <p className="text-xs text-rose-600">
                    {t(
                      templatesState.error ?? "We couldn't load schema templates."
                    )}
                  </p>
                ) : templatesState.data.length === 0 ? (
                  <p className="text-xs text-stone-500">
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

                <p className="text-xs text-stone-500">
                  {t("Need a new template?")}
                  {" "}
                  <Link href="/schema-templates" className="font-medium text-amber-700">
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
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              {t("What happens next")}
            </p>
            <h3 className="font-display mt-3 text-2xl text-stone-900">
              {t("Build your schema and start cataloguing.")}
            </h3>
            <p className="mt-3 text-sm text-stone-600">
              {t(
                "After creating the collection, define metadata fields, then add items and images from any device."
              )}
            </p>
            <div className="mt-6 space-y-4 text-sm text-stone-600">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <FolderPlus className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-stone-900">{t("Define fields")}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {t("Set up condition, era, provenance, and more.")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-stone-900">{t("Capture imagery")}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {t("Upload photos or use the mobile camera capture button.")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-stone-900">{t("Share publicly")}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {t("Publish the collection when you are ready.")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-900/90 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-6 text-stone-100 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
              {t("Studio note")}
            </p>
            <p className="mt-3 text-sm text-stone-300">
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

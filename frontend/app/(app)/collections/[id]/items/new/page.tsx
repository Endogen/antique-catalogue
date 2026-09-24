"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, RefreshCcw } from "lucide-react";

import { ItemForm, type ItemFormValues } from "@/components/item-form";
import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  collectionApi,
  fieldApi,
  isApiError,
  itemApi,
  type CollectionResponse,
  type FieldDefinitionResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { Card, EmptyState } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

export default function NewItemPage() {
  const params = useParams();
  const router = useRouter();
  const { t, tc } = useI18n();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const collectionQuery = useQuery({
    queryKey: queryKeys.collections.detail(Number(collectionId)),
    queryFn: ({ signal }) => collectionApi.get(collectionId!, { signal }),
    enabled: Boolean(collectionId)
  });
  const fieldsQuery = useQuery({
    queryKey: queryKeys.collections.fields(Number(collectionId)),
    queryFn: ({ signal }) => fieldApi.list(collectionId!, { signal }),
    enabled: Boolean(collectionId)
  });

  const collectionState = toLoadState<CollectionResponse | undefined>(
    collectionQuery,
    "We couldn't load this collection.",
    undefined
  );
  const fieldsState = toLoadState<FieldDefinitionResponse[]>(
    fieldsQuery,
    "We couldn't load the collection schema.",
    []
  );
  const [formError, setFormError] = React.useState<string | null>(null);

  const { refetch: refetchCollection } = collectionQuery;
  const { refetch: refetchFields } = fieldsQuery;
  const loadCollection = React.useCallback(() => {
    void refetchCollection();
  }, [refetchCollection]);
  const loadFields = React.useCallback(() => {
    void refetchFields();
  }, [refetchFields]);


  const handleSubmit = async (values: ItemFormValues) => {
    if (!collectionId) {
      return;
    }
    setFormError(null);
    try {
      const created = await itemApi.create(collectionId, {
        name: values.name,
        notes: values.notes,
        metadata: values.metadata,
        is_highlight: values.is_highlight
      });
      router.push(`/collections/${collectionId}/items/${created.id}`);
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't create this item. Please try again."
      );
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="-ml-3" asChild>
            <Link href={`/collections/${collectionId ?? ""}`}>
              <ArrowLeft className="h-4 w-4" />
              {t("Back to collection")}
            </Link>
          </Button>
          <div>
            <Eyebrow tone="brand" spacing="wide">
              {t("New item")}
            </Eyebrow>
            <SectionHeading as="h1" size="xl" className="mt-4">
              {t("Capture a new item for your archive.")}
            </SectionHeading>
            <p className="mt-3 max-w-2xl text-sm text-muted-strong">
              {t(
                "Record the item name, optional notes, and the metadata fields you defined in your schema."
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={loadFields}>
            <RefreshCcw className="h-4 w-4" />
            {t("Reload schema")}
          </Button>
        </div>
      </header>

      {collectionState.status === "loading" ? (
        <EmptyState
          aria-busy="true">
          {t("Loading collection details...")}
        </EmptyState>
      ) : collectionState.status === "error" ? (
        <Alert className="rounded-3xl p-6">
          <p className="text-sm font-medium text-destructive">
            {t("We hit a snag loading this collection.")}
          </p>
          <p className="mt-2 text-sm text-destructive">
            {t(collectionState.error ?? "Please try again.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={loadCollection}>
              {t("Try again")}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/collections">{t("Back to collections")}</Link>
            </Button>
          </div>
        </Alert>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <Eyebrow>
              {t("Item details")}
            </Eyebrow>
            <SectionHeading className="mt-3">
              {collectionState.data?.name}
            </SectionHeading>
            <p className="mt-3 text-sm text-muted-strong">
              {collectionState.data?.description ??
                t(
                  "Add a description to capture the story behind this collection."
                )}
            </p>

            <div className="mt-6">
              {fieldsState.status === "loading" ? (
                <EmptyState size="sm">
                  {t("Loading schema fields...")}
                </EmptyState>
              ) : fieldsState.status === "error" ? (
                <Alert className="space-y-3">
                  <p>
                    {t(
                      fieldsState.error ??
                        "We couldn't load the schema fields. Please try again."
                    )}
                  </p>
                  <Button size="sm" variant="outline" onClick={loadFields}>
                    {t("Try again")}
                  </Button>
                </Alert>
              ) : (
                <ItemForm
                  fields={fieldsState.data}
                  onSubmit={handleSubmit}
                  submitLabel={t("Create item")}
                  submitPendingLabel={t("Creating item...")}
                  secondaryAction={
                    <Button variant="ghost" type="button" asChild>
                      <Link href={`/collections/${collectionId}`}>{t("Cancel")}</Link>
                    </Button>
                  }
                  formError={formError}
                />
              )}
            </div>
          </Card>

          <aside className="space-y-6">
            <Card tone="subtle">
              <Eyebrow>
                {t("Schema snapshot")}
              </Eyebrow>
              {fieldsState.status === "loading" ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {t("Loading schema fields...")}
                </p>
              ) : fieldsState.status === "error" ? (
                <p className="mt-4 text-sm text-destructive">
                  {t(fieldsState.error ?? "We couldn't load schema fields.")}
                </p>
              ) : fieldsState.data.length === 0 ? (
                <div className="mt-4 space-y-3 text-sm text-muted-strong">
                  <p>{t("No schema fields yet.")}</p>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/collections/${collectionId}/settings`}>
                      {t("Define schema")}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="mt-4 space-y-3 text-sm text-muted-strong">
                  <p>
                    {tc(fieldsState.data.length, "{count} field available.", "{count} fields available.")}
                  </p>
                  <div className="space-y-2">
                    {fieldsState.data.slice(0, 5).map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="font-medium text-foreground">
                          {field.name}
                        </span>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-subtle">
                          {field.field_type}
                        </span>
                      </div>
                    ))}
                    {fieldsState.data.length > 5 ? (
                      <p className="text-xs text-muted-subtle">
                        {tc(fieldsState.data.length - 5, "+{count} more field", "+{count} more fields")}
                      </p>
                    ) : null}
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/collections/${collectionId}/settings`}>
                      {t("Edit schema")}
                    </Link>
                  </Button>
                </div>
              )}
            </Card>

            <div className="rounded-3xl border border-panel-border/90 surface-panel p-6 text-panel-foreground shadow-sm">
              <Eyebrow tone="panel">
                {t("Capture notes")}
              </Eyebrow>
              <h3 className="font-display mt-3 text-2xl text-panel-foreground">
                {t("Keep provenance close at hand.")}
              </h3>
              <p className="mt-3 text-sm text-panel-muted-foreground">
                {t(
                  "Use the notes field to document acquisition details, restoration work, or exhibition history alongside metadata."
                )}
              </p>
              <div className="mt-6 flex items-center gap-3 text-xs text-panel-muted-foreground">
                <ClipboardList className="h-4 w-4 text-amber-300" />
                {t("Metadata fields are validated before saving.")}
              </div>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}

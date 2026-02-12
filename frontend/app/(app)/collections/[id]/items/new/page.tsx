"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, RefreshCcw } from "lucide-react";

import { ItemForm, type ItemFormValues } from "@/components/item-form";
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

type LoadState = {
  status: "loading" | "ready" | "error";
  data?: CollectionResponse;
  error?: string;
};

type FieldsState = {
  status: "loading" | "ready" | "error";
  data: FieldDefinitionResponse[];
  error?: string;
};

export default function NewItemPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [collectionState, setCollectionState] = React.useState<LoadState>({
    status: "loading"
  });
  const [fieldsState, setFieldsState] = React.useState<FieldsState>({
    status: "loading",
    data: []
  });
  const [formError, setFormError] = React.useState<string | null>(null);

  const loadCollection = React.useCallback(async () => {
    if (!collectionId) {
      setCollectionState({
        status: "error",
        error: "Collection ID was not provided."
      });
      return;
    }

    setCollectionState({ status: "loading" });
    try {
      const data = await collectionApi.get(collectionId);
      setCollectionState({ status: "ready", data });
    } catch (error) {
      setCollectionState({
        status: "error",
        error: isApiError(error)
          ? error.detail
          : "We couldn't load this collection."
      });
    }
  }, [collectionId]);

  const loadFields = React.useCallback(async () => {
    if (!collectionId) {
      setFieldsState({
        status: "error",
        data: [],
        error: "Collection ID was not provided."
      });
      return;
    }

    setFieldsState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));
    try {
      const data = await fieldApi.list(collectionId);
      setFieldsState({ status: "ready", data });
    } catch (error) {
      setFieldsState({
        status: "error",
        data: [],
        error: isApiError(error)
          ? error.detail
          : "We couldn't load the collection schema."
      });
    }
  }, [collectionId]);

  React.useEffect(() => {
    void loadCollection();
    void loadFields();
  }, [loadCollection, loadFields]);

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
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/collections/${collectionId ?? ""}`}>
              <ArrowLeft className="h-4 w-4" />
              {t("Back to collection")}
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              {t("New item")}
            </p>
            <h1 className="font-display mt-4 text-3xl text-stone-900">
              {t("Capture a new item for your archive.")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-stone-600">
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
        <div
          className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
          aria-busy="true"
        >
          {t("Loading collection details...")}
        </div>
      ) : collectionState.status === "error" ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
          <p className="text-sm font-medium text-rose-700">
            {t("We hit a snag loading this collection.")}
          </p>
          <p className="mt-2 text-sm text-rose-600">
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
        </div>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              {t("Item details")}
            </p>
            <h2 className="font-display mt-3 text-2xl text-stone-900">
              {collectionState.data?.name}
            </h2>
            <p className="mt-3 text-sm text-stone-600">
              {collectionState.data?.description ??
                t(
                  "Add a description to capture the story behind this collection."
                )}
            </p>

            <div className="mt-6">
              {fieldsState.status === "loading" ? (
                <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                  {t("Loading schema fields...")}
                </div>
              ) : fieldsState.status === "error" ? (
                <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <p>
                    {t(
                      fieldsState.error ??
                        "We couldn't load the schema fields. Please try again."
                    )}
                  </p>
                  <Button size="sm" variant="outline" onClick={loadFields}>
                    {t("Try again")}
                  </Button>
                </div>
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
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                {t("Schema snapshot")}
              </p>
              {fieldsState.status === "loading" ? (
                <p className="mt-4 text-sm text-stone-500">
                  {t("Loading schema fields...")}
                </p>
              ) : fieldsState.status === "error" ? (
                <p className="mt-4 text-sm text-rose-600">
                  {t(fieldsState.error ?? "We couldn't load schema fields.")}
                </p>
              ) : fieldsState.data.length === 0 ? (
                <div className="mt-4 space-y-3 text-sm text-stone-600">
                  <p>{t("No schema fields yet.")}</p>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/collections/${collectionId}/settings`}>
                      {t("Define schema")}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="mt-4 space-y-3 text-sm text-stone-600">
                  <p>
                    {t("{count} fields available.", {
                      count: fieldsState.data.length
                    })}
                  </p>
                  <div className="space-y-2">
                    {fieldsState.data.slice(0, 5).map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="font-medium text-stone-900">
                          {field.name}
                        </span>
                        <span className="text-xs uppercase tracking-[0.2em] text-stone-400">
                          {field.field_type}
                        </span>
                      </div>
                    ))}
                    {fieldsState.data.length > 5 ? (
                      <p className="text-xs text-stone-400">
                        {t("+{count} more fields", {
                          count: fieldsState.data.length - 5
                        })}
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
            </div>

            <div className="rounded-3xl border border-stone-900/90 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-6 text-stone-100 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                {t("Capture notes")}
              </p>
              <h3 className="font-display mt-3 text-2xl text-stone-100">
                {t("Keep provenance close at hand.")}
              </h3>
              <p className="mt-3 text-sm text-stone-300">
                {t(
                  "Use the notes field to document acquisition details, restoration work, or exhibition history alongside metadata."
                )}
              </p>
              <div className="mt-6 flex items-center gap-3 text-xs text-stone-300">
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

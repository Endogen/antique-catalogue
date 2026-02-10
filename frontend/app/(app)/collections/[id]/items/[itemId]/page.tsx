"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Pencil,
  RefreshCcw,
  ShieldAlert,
  Tag,
  Trash2
} from "lucide-react";

import { ItemForm, type ItemFormValues } from "@/components/item-form";
import { ImageGallery } from "@/components/image-gallery";
import { ImageUploader } from "@/components/image-uploader";
import { Button } from "@/components/ui/button";
import {
  collectionApi,
  fieldApi,
  isApiError,
  itemApi,
  type CollectionResponse,
  type FieldDefinitionResponse,
  type ItemResponse
} from "@/lib/api";

type LoadState<T> = {
  status: "loading" | "ready" | "error";
  data?: T;
  error?: string;
};

type FieldsState = {
  status: "loading" | "ready" | "error";
  data: FieldDefinitionResponse[];
  error?: string;
};

type DeleteState = {
  status: "idle" | "working" | "error";
  message?: string;
};

const fieldTypeLabels: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  timestamp: "Timestamp",
  checkbox: "Checkbox",
  select: "Select"
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
};

const formatFieldValue = (value: unknown, fieldType?: string) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (fieldType === "checkbox") {
    return typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  }

  if (fieldType === "number") {
    return typeof value === "number" ? value.toLocaleString("en-US") : String(value);
  }

  if (fieldType === "date") {
    return typeof value === "string" ? formatDate(value) : String(value);
  }

  if (fieldType === "timestamp") {
    return typeof value === "string" ? formatDateTime(value) : String(value);
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return "Details";
  }

  return String(value);
};

const sortFields = (items: FieldDefinitionResponse[]) =>
  [...items].sort((a, b) => a.position - b.position || a.id - b.id);

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const itemId = Array.isArray(params?.itemId)
    ? params.itemId[0]
    : params?.itemId;

  const [collectionState, setCollectionState] = React.useState<
    LoadState<CollectionResponse>
  >({
    status: "loading"
  });
  const [itemState, setItemState] = React.useState<LoadState<ItemResponse>>({
    status: "loading"
  });
  const [fieldsState, setFieldsState] = React.useState<FieldsState>({
    status: "loading",
    data: []
  });
  const [isEditing, setIsEditing] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [imageRefreshToken, setImageRefreshToken] = React.useState(0);
  const [deletePhrase, setDeletePhrase] = React.useState("");
  const [deleteState, setDeleteState] = React.useState<DeleteState>({
    status: "idle"
  });

  const sortedFields = React.useMemo(
    () => sortFields(fieldsState.data),
    [fieldsState.data]
  );

  const metadataMap = React.useMemo(() => {
    if (itemState.status !== "ready") {
      return {} as Record<string, unknown>;
    }
    return itemState.data?.metadata ?? {};
  }, [itemState.data, itemState.status]);

  const metadataEntries = React.useMemo(
    () => Object.entries(metadataMap),
    [metadataMap]
  );

  const fieldNameSet = React.useMemo(
    () => new Set(sortedFields.map((field) => field.name)),
    [sortedFields]
  );

  const additionalMetadata = React.useMemo(
    () => metadataEntries.filter(([key]) => !fieldNameSet.has(key)),
    [metadataEntries, fieldNameSet]
  );

  const canEdit = itemState.status === "ready" && fieldsState.status !== "error";
  const confirmDeleteMatches = deletePhrase.trim().toUpperCase() === "DELETE";

  const loadCollection = React.useCallback(async () => {
    if (!collectionId) {
      setCollectionState({
        status: "error",
        error: "Collection ID was not provided."
      });
      return;
    }

    setCollectionState({
      status: "loading"
    });
    try {
      const data = await collectionApi.get(collectionId);
      setCollectionState({
        status: "ready",
        data
      });
    } catch (error) {
      setCollectionState({
        status: "error",
        error: isApiError(error)
          ? error.detail
          : "We couldn't load this collection."
      });
    }
  }, [collectionId]);

  const loadItem = React.useCallback(async () => {
    if (!collectionId || !itemId) {
      setItemState({
        status: "error",
        error: "Item ID was not provided."
      });
      return;
    }

    setItemState({
      status: "loading"
    });
    try {
      const data = await itemApi.get(collectionId, itemId);
      setItemState({
        status: "ready",
        data
      });
    } catch (error) {
      setItemState({
        status: "error",
        error: isApiError(error) ? error.detail : "We couldn't load this item."
      });
    }
  }, [collectionId, itemId]);

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
      setFieldsState({
        status: "ready",
        data
      });
    } catch (error) {
      setFieldsState({
        status: "error",
        data: [],
        error: isApiError(error)
          ? error.detail
          : "We couldn't load the schema fields."
      });
    }
  }, [collectionId]);

  React.useEffect(() => {
    void loadCollection();
    void loadItem();
    void loadFields();
  }, [loadCollection, loadFields, loadItem]);

  React.useEffect(() => {
    if (!isEditing) {
      return;
    }
    setFormError(null);
    setSaveMessage(null);
  }, [isEditing]);

  const handleRefresh = () => {
    void loadCollection();
    void loadItem();
    void loadFields();
  };

  const handleSubmit = async (values: ItemFormValues) => {
    if (!collectionId || !itemId) {
      return;
    }
    setFormError(null);
    try {
      const updated = await itemApi.update(collectionId, itemId, {
        name: values.name,
        notes: values.notes,
        metadata: values.metadata,
        is_highlight: values.is_highlight
      });
      setItemState({
        status: "ready",
        data: updated
      });
      setIsEditing(false);
      setSaveMessage("Item updates saved successfully.");
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't save changes. Please try again."
      );
    }
  };

  const handleDelete = async () => {
    if (!collectionId || !itemId || deleteState.status === "working") {
      return;
    }

    setDeleteState({
      status: "working"
    });
    try {
      await itemApi.delete(collectionId, itemId);
      router.push(`/collections/${collectionId}`);
    } catch (error) {
      setDeleteState({
        status: "error",
        message: isApiError(error)
          ? error.detail
          : "We couldn't delete this item. Please try again."
      });
    }
  };

  const handleImageUploaded = React.useCallback(() => {
    setImageRefreshToken((prev) => prev + 1);
  }, []);

  const collectionName =
    collectionState.status === "ready" ? collectionState.data?.name : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/collections/${collectionId ?? ""}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to collection
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              Item detail
            </p>
            <h1 className="font-display mt-4 text-3xl text-stone-900">
              {itemState.status === "ready" && itemState.data
                ? itemState.data.name
                : "Review item details"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-stone-600">
              View metadata, notes, and the current schema for this catalogued
              item.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          {itemState.status === "ready" ? (
            <Button
              variant={isEditing ? "ghost" : "secondary"}
              onClick={() => setIsEditing((prev) => !prev)}
              disabled={!canEdit}
              title={!canEdit ? "Reload schema to edit this item." : undefined}
            >
              <Pencil className="h-4 w-4" />
              {isEditing ? "Cancel edit" : "Edit item"}
            </Button>
          ) : null}
        </div>
      </header>

      {itemState.status === "loading" ? (
        <div
          className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
          aria-busy="true"
        >
          Loading item details...
        </div>
      ) : itemState.status === "error" ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
          <p className="text-sm font-medium text-rose-700">
            We hit a snag loading this item.
          </p>
          <p className="mt-2 text-sm text-rose-600">
            {itemState.error ?? "Please try again."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleRefresh}>
              Try again
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/collections">Back to collections</Link>
            </Button>
          </div>
        </div>
      ) : (
        <section className="space-y-6">
          <div className="space-y-6">
            {isEditing ? (
              <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  Edit item
                </p>
                <h2 className="font-display mt-3 text-2xl text-stone-900">
                  Update item information.
                </h2>
                <p className="mt-3 text-sm text-stone-600">
                  Adjust the item name, notes, and schema-specific metadata
                  fields.
                </p>

                <div className="mt-6">
                  {fieldsState.status === "loading" ? (
                    <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                      Loading schema fields...
                    </div>
                  ) : fieldsState.status === "error" ? (
                    <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <p>
                        {fieldsState.error ??
                          "We couldn't load the schema fields. Please try again."}
                      </p>
                      <Button size="sm" variant="outline" onClick={loadFields}>
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <ItemForm
                      fields={fieldsState.data}
                      initialValues={{
                        name: itemState.data?.name ?? "",
                        notes: itemState.data?.notes ?? "",
                        metadata: itemState.data?.metadata ?? null,
                        is_highlight: itemState.data?.is_highlight ?? false
                      }}
                      onSubmit={handleSubmit}
                      submitLabel="Save changes"
                      submitPendingLabel="Saving changes..."
                      secondaryAction={
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => setIsEditing(false)}
                        >
                          Cancel
                        </Button>
                      }
                      formError={formError}
                    />
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                    Item overview
                  </p>
                  <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h2 className="font-display text-2xl text-stone-900">
                            {itemState.data?.name}
                          </h2>
                          <p className="mt-2 text-sm text-stone-600">
                            {collectionName
                              ? `Collection: ${collectionName}`
                              : "Collection details unavailable."}
                          </p>
                        </div>
                        <span className="text-xs text-stone-500">
                          Updated {formatDate(itemState.data?.updated_at)}
                        </span>
                      </div>

                      {saveMessage ? (
                        <div
                          role="status"
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                        >
                          {saveMessage}
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                              Notes
                            </p>
                            <p className="mt-2 text-sm text-stone-600">
                              {itemState.data?.notes ? "" : "No notes added yet."}
                            </p>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">
                            <ClipboardList className="h-5 w-5" />
                          </div>
                        </div>
                        {itemState.data?.notes ? (
                          <p className="mt-3 whitespace-pre-wrap text-sm text-stone-700">
                            {itemState.data.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                        Item snapshot
                      </p>
                      <h3 className="font-display mt-3 text-xl text-stone-900">
                        Quick overview
                      </h3>
                      <div className="mt-4 space-y-4 text-sm text-stone-600">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                            <CalendarDays className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-stone-900">Created</p>
                            <p>{formatDate(itemState.data?.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                            <RefreshCcw className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-stone-900">Updated</p>
                            <p>{formatDate(itemState.data?.updated_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                            <Tag className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-stone-900">
                              Metadata fields
                            </p>
                            <p>{sortedFields.length} schema fields</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                    Metadata
                  </p>
                  <h3 className="font-display mt-3 text-2xl text-stone-900">
                    Schema attributes
                  </h3>
                  <p className="mt-3 text-sm text-stone-600">
                    Review each field captured for this item.
                  </p>

                  <div className="mt-6">
                    {fieldsState.status === "loading" ? (
                      <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                        Loading schema fields...
                      </div>
                    ) : fieldsState.status === "error" ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {fieldsState.error ??
                          "We couldn't load schema fields. Metadata may be incomplete."}
                      </div>
                    ) : sortedFields.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
                        No schema fields yet. Define fields to capture structured
                        metadata for this item.
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {sortedFields.map((field) => {
                          const rawValue = metadataMap[field.name];
                          const isMissing =
                            rawValue === null ||
                            rawValue === undefined ||
                            rawValue === "";
                          const displayValue = isMissing
                            ? "Not provided"
                            : formatFieldValue(rawValue, field.field_type);

                          return (
                            <div
                              key={field.id}
                              className="rounded-2xl border border-stone-200 bg-white/80 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-stone-900">
                                  {field.name}
                                </p>
                                <span className="text-xs uppercase tracking-[0.2em] text-stone-400">
                                  {fieldTypeLabels[field.field_type] ??
                                    field.field_type}
                                  {field.is_required ? " · Required" : ""}
                                </span>
                              </div>
                              <p
                                className={`mt-3 text-sm ${
                                  isMissing
                                    ? "text-stone-400"
                                    : "text-stone-700"
                                }`}
                              >
                                {displayValue}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {additionalMetadata.length > 0 ? (
                    <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                        Additional metadata
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-stone-600">
                        {additionalMetadata.map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="font-medium text-stone-700">
                              {key}
                            </span>
                            <span className="text-stone-500">
                              {formatFieldValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}

            <ImageGallery
              itemId={itemId ?? null}
              disabled={itemState.status !== "ready"}
              refreshToken={imageRefreshToken}
              editable={isEditing}
            />
            {isEditing ? (
              <ImageUploader
                itemId={itemId ?? null}
                disabled={itemState.status !== "ready"}
                onUploaded={handleImageUploaded}
              />
            ) : null}

            {isEditing ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-rose-600">
                      Danger zone
                    </p>
                    <h3 className="font-display mt-3 text-2xl text-stone-900">
                      Permanently delete this item.
                    </h3>
                    <p className="mt-3 text-sm text-rose-700">
                      This removes the item and any attached imagery. Type DELETE
                      to confirm.
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  <div>
                    <label
                      className="text-sm font-medium text-rose-700"
                      htmlFor="delete-confirm"
                    >
                      Confirmation phrase
                    </label>
                    <input
                      id="delete-confirm"
                      type="text"
                      className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      value={deletePhrase}
                      onChange={(event) => setDeletePhrase(event.target.value)}
                      placeholder="Type DELETE to confirm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-rose-200 text-rose-700 hover:bg-rose-100"
                    disabled={!confirmDeleteMatches || deleteState.status === "working"}
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteState.status === "working"
                      ? "Deleting..."
                      : "Delete item"}
                  </Button>
                </div>

                {deleteState.status === "error" && deleteState.message ? (
                  <div
                    role="alert"
                    className="mt-4 rounded-2xl border border-rose-200 bg-white/80 px-4 py-3 text-sm text-rose-700"
                  >
                    {deleteState.message}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

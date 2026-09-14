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
  Sparkles,
  Star,
  Tag,
  Trash2
} from "lucide-react";

import { ItemForm, type ItemFormValues } from "@/components/item-form";
import { ImageGallery } from "@/components/image-gallery";
import { ImageUploader } from "@/components/image-uploader";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  collectionApi,
  fieldApi,
  isApiError,
  itemApi,
  starsApi,
  type CollectionResponse,
  type FieldDefinitionResponse,
  type ItemUpdatePayload,
  type MovePreview,
  type ItemResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { formatMetadataNumber } from "@/lib/format";
import { Card, EmptyState } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

type DeleteState = {
  status: "idle" | "working" | "error";
  message?: string;
};

const DELETE_TOKEN = "DELETE";

const buildFieldTypeLabels = (t: (key: string) => string): Record<string, string> => ({
  text: t("Text"),
  number: t("Number"),
  date: t("Date"),
  timestamp: t("Timestamp"),
  checkbox: t("Checkbox"),
  select: t("Select")
});

const sortFields = (items: FieldDefinitionResponse[]) =>
  [...items].sort((a, b) => a.position - b.position || a.id - b.id);

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, tc, locale } = useI18n();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const itemId = Array.isArray(params?.itemId)
    ? params.itemId[0]
    : params?.itemId;

  const fieldTypeLabels = React.useMemo(() => buildFieldTypeLabels(t), [t]);

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

  const formatDateTime = React.useCallback(
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
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(parsed);
    },
    [locale]
  );

  const formatFieldValue = React.useCallback(
    (value: unknown, fieldType?: string) => {
      if (value === null || value === undefined || value === "") {
        return "—";
      }

      if (fieldType === "checkbox") {
        return typeof value === "boolean" ? (value ? t("Yes") : t("No")) : String(value);
      }

      if (fieldType === "number") {
        return typeof value === "number"
          ? formatMetadataNumber(locale, value)
          : String(value);
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
        return t("Details");
      }

      return String(value);
    },
    [formatDate, formatDateTime, locale, t]
  );

  const queryClient = useQueryClient();
  const itemKey = queryKeys.items.detail(Number(itemId));

  const collectionQuery = useQuery({
    queryKey: queryKeys.collections.detail(Number(collectionId)),
    queryFn: ({ signal }) => collectionApi.get(collectionId!, { signal }),
    enabled: Boolean(collectionId)
  });
  const collectionsQuery = useQuery({
    queryKey: queryKeys.collections.list(),
    queryFn: ({ signal }) => collectionApi.list({ signal })
  });
  const itemQuery = useQuery({
    queryKey: itemKey,
    queryFn: ({ signal }) => itemApi.get(collectionId!, itemId!, { signal }),
    enabled: Boolean(collectionId) && Boolean(itemId)
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
  const collectionsState = toLoadState<CollectionResponse[] | undefined>(
    collectionsQuery,
    "We couldn't load your collections.",
    undefined
  );
  const itemState = toLoadState<ItemResponse | undefined>(
    itemQuery,
    "We couldn't load this item.",
    undefined
  );
  const fieldsState = toLoadState<FieldDefinitionResponse[]>(
    fieldsQuery,
    "We couldn't load the schema fields.",
    []
  );

  const setItemData = React.useCallback(
    (item: ItemResponse) => {
      queryClient.setQueryData(itemKey, item);
    },
    [queryClient, itemKey]
  );
  const applyItemStarCount = React.useCallback(
    (starCount: number) => {
      queryClient.setQueryData<ItemResponse | undefined>(itemKey, (previous) =>
        previous ? { ...previous, star_count: starCount } : previous
      );
    },
    [queryClient, itemKey]
  );
  const [isEditing, setIsEditing] = React.useState(false);
  const [movePreview, setMovePreview] = React.useState<MovePreview | null>(null);
  const [movePreviewError, setMovePreviewError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [imageRefreshToken, setImageRefreshToken] = React.useState(0);
  const [deletePhrase, setDeletePhrase] = React.useState("");
  const [deleteState, setDeleteState] = React.useState<DeleteState>({
    status: "idle"
  });
  const [itemStarred, setItemStarred] = React.useState(false);
  const [isUpdatingItemStar, setIsUpdatingItemStar] = React.useState(false);
  const [itemStarError, setItemStarError] = React.useState<string | null>(null);
  const [destinationCollectionId, setDestinationCollectionId] =
    React.useState<string>("");

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

  const availableCollections =
    collectionsState.status === "ready" ? collectionsState.data ?? [] : [];
  const currentCollectionIdNumber = collectionId ? Number(collectionId) : Number.NaN;
  const destinationCollectionIdNumber = destinationCollectionId
    ? Number(destinationCollectionId)
    : Number.NaN;
  const isDestinationCollectionValid =
    Number.isInteger(destinationCollectionIdNumber) && destinationCollectionIdNumber > 0;
  const isMovingToAnotherCollection =
    Number.isInteger(currentCollectionIdNumber) &&
    isDestinationCollectionValid &&
    destinationCollectionIdNumber !== currentCollectionIdNumber;

  React.useEffect(() => {
    setMovePreview(null);
    setMovePreviewError(null);
    if (!isMovingToAnotherCollection || !collectionId || !itemId) return;
    let active = true;
    itemApi.previewMove(collectionId, itemId, destinationCollectionIdNumber).then(
      preview => { if (active) setMovePreview(preview); },
      error => { if (active) setMovePreviewError(isApiError(error) ? error.detail : "Could not preview this move. Please retry."); }
    );
    return () => { active = false; };
  }, [isMovingToAnotherCollection, collectionId, itemId, destinationCollectionIdNumber]);

  const canEdit = itemState.status === "ready" && fieldsState.status !== "error";
  const confirmDeleteMatches = deletePhrase.trim().toUpperCase() === DELETE_TOKEN;

  const { refetch: refetchCollection } = collectionQuery;
  const { refetch: refetchCollections } = collectionsQuery;
  const { refetch: refetchItem } = itemQuery;
  const { refetch: refetchFields } = fieldsQuery;
  const loadCollection = React.useCallback(() => {
    void refetchCollection();
  }, [refetchCollection]);
  const loadCollections = React.useCallback(() => {
    void refetchCollections();
  }, [refetchCollections]);
  const loadItem = React.useCallback(() => {
    void refetchItem();
  }, [refetchItem]);
  const loadFields = React.useCallback(() => {
    void refetchFields();
  }, [refetchFields]);


  const loadItemStarStatus = React.useCallback(async () => {
    if (!collectionId || !itemId) {
      return;
    }
    try {
      const status = await starsApi.itemStatus(collectionId, itemId);
      setItemStarred(status.starred);
      applyItemStarCount(status.star_count);
    } catch (error) {
      if (!isApiError(error) || error.status !== 404) {
        setItemStarError(
          isApiError(error) ? error.detail : "We couldn't update star status."
        );
      }
    }
  }, [applyItemStarCount, collectionId, itemId]);

  React.useEffect(() => {
    void loadItemStarStatus();
  }, [loadItemStarStatus]);

  React.useEffect(() => {
    if (!isEditing) {
      return;
    }
    setFormError(null);
    setSaveMessage(null);
  }, [isEditing]);

  React.useEffect(() => {
    if (itemState.status !== "ready" || !itemState.data) {
      return;
    }
    setDestinationCollectionId(String(itemState.data.collection_id));
  }, [itemState.data, itemState.status]);

  const handleRefresh = () => {
    void loadCollection();
    void loadCollections();
    void loadItem();
    void loadFields();
    void loadItemStarStatus();
    setItemStarError(null);
  };

  const handleToggleItemStar = async () => {
    if (!collectionId || !itemId || isUpdatingItemStar) {
      return;
    }
    setItemStarError(null);
    setIsUpdatingItemStar(true);
    try {
      const status = itemStarred
        ? await starsApi.unstarItem(collectionId, itemId)
        : await starsApi.starItem(collectionId, itemId);
      setItemStarred(status.starred);
      applyItemStarCount(status.star_count);
    } catch (error) {
      setItemStarError(
        isApiError(error) ? error.detail : "We couldn't update stars."
      );
    } finally {
      setIsUpdatingItemStar(false);
    }
  };

  const handleSubmit = async (values: ItemFormValues) => {
    if (!collectionId || !itemId) {
      return;
    }
    setFormError(null);
    setSaveMessage(null);
    if (!isDestinationCollectionValid) {
      setFormError("Choose a destination collection.");
      return;
    }

    if (isMovingToAnotherCollection && !movePreview) {
      setFormError(movePreviewError ?? "Please wait for the move preview.");
      return;
    }
    const payload: ItemUpdatePayload = {
      name: values.name,
      notes: values.notes,
      is_highlight: values.is_highlight
    };
    if (!isMovingToAnotherCollection) {
      payload.metadata = values.metadata;
    }
    if (isMovingToAnotherCollection) {
      payload.collection_id = destinationCollectionIdNumber;
    }

    try {
      const updated = await itemApi.update(collectionId, itemId, payload);
      setItemData(updated);
      setIsEditing(false);
      if (isMovingToAnotherCollection) {
        router.push(`/collections/${updated.collection_id}/items/${updated.id}`);
        return;
      }
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
      {itemState.data?.is_draft && <p role="status" className="rounded-xl bg-brand-muted p-4 text-sm text-brand-strong">{t("This item is a private draft. Complete its fields and save to publish it in this collection.")}</p>}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/collections/${collectionId ?? ""}`}>
              <ArrowLeft className="h-4 w-4" />
              {t("Back to collection")}
            </Link>
          </Button>
          <div>
            <Eyebrow tone="brand" spacing="wide">
              {t("Item detail")}
            </Eyebrow>
            <SectionHeading as="h1" size="xl" className="mt-4">
              {itemState.status === "ready" && itemState.data
                ? itemState.data.name
                : t("Review item details")}
            </SectionHeading>
            <p className="mt-3 max-w-2xl text-sm text-muted-strong">
              {t(
                "View metadata, notes, and the current schema for this catalogued item."
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant={itemStarred ? "secondary" : "outline"}
            onClick={handleToggleItemStar}
            disabled={isUpdatingItemStar}
          >
            <Star className={`h-4 w-4 ${itemStarred ? "fill-current" : ""}`} />
            {itemStarred ? t("Starred") : t("Star")}
          </Button>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCcw className="h-4 w-4" />
            {t("Refresh")}
          </Button>
          {itemState.status === "ready" ? (
            <Button
              variant={isEditing ? "ghost" : "secondary"}
              onClick={() => setIsEditing((prev) => !prev)}
              disabled={!canEdit}
              title={!canEdit ? t("Reload schema to edit this item.") : undefined}
            >
              <Pencil className="h-4 w-4" />
              {isEditing ? t("Cancel edit") : t("Edit item")}
            </Button>
          ) : null}
        </div>
      </header>
      {itemStarError ? (
        <p className="text-sm text-destructive">{t(itemStarError)}</p>
      ) : null}

      {itemState.status === "loading" ? (
        <EmptyState
          aria-busy="true">
          {t("Loading item details...")}
        </EmptyState>
      ) : itemState.status === "error" ? (
        <Alert className="rounded-3xl p-6">
          <p className="text-sm font-medium text-destructive">
            {t("We hit a snag loading this item.")}
          </p>
          <p className="mt-2 text-sm text-destructive">
            {t(itemState.error ?? "Please try again.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleRefresh}>
              {t("Try again")}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/collections">{t("Back to collections")}</Link>
            </Button>
          </div>
        </Alert>
      ) : (
        <section className="space-y-6">
          {isEditing ? (
            <ItemForm
              fields={fieldsState.data}
              initialValues={{
                name: itemState.data?.name ?? "",
                notes: itemState.data?.notes ?? "",
                metadata: itemState.data?.metadata ?? null,
                is_highlight: itemState.data?.is_highlight ?? false
              }}
              onSubmit={handleSubmit}
              skipMetadataValidation={isMovingToAnotherCollection}
              submitLabel={t(itemState.data?.is_draft && collectionState.data?.is_public && !isMovingToAnotherCollection ? "Save and publish" : "Save changes")}
              submitPendingLabel={t("Saving changes...")}
              secondaryAction={
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setIsEditing(false)}
                >
                  {t("Cancel")}
                </Button>
              }
              formError={formError}
              render={({ formError: formErrorNode, baseFields, metadataFields, actions }) => (
                <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
                  <div className="space-y-6">
                    <Card>
                      <Eyebrow>
                        {t("Edit item")}
                      </Eyebrow>
                      <SectionHeading className="mt-3">
                        {t("Update item information.")}
                      </SectionHeading>
                      <p className="mt-3 text-sm text-muted-strong">
                        {t(
                          "Adjust the item name, notes, and schema-specific metadata fields."
                        )}
                      </p>

                      <div className="mt-6 space-y-6">
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
                          <>
                            {formErrorNode}
                            {baseFields}
                            <div className="space-y-2">
                              <label
                                className="text-sm font-medium text-muted-strong"
                                htmlFor="destination-collection"
                              >
                                {t("Collection")}
                              </label>
                              <select
                                id="destination-collection"
                                className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-muted-strong shadow-sm transition focus:border-brand-border focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
                                value={destinationCollectionId}
                                onChange={(event) =>
                                  setDestinationCollectionId(event.target.value)
                                }
                                disabled={
                                  collectionsState.status !== "ready" ||
                                  availableCollections.length === 0
                                }
                              >
                                {availableCollections.map((collectionOption) => (
                                  <option
                                    key={collectionOption.id}
                                    value={collectionOption.id}
                                  >
                                    {collectionOption.name}
                                  </option>
                                ))}
                              </select>
                              {collectionsState.status === "loading" ? (
                                <p className="text-xs text-muted-foreground">
                                  {t("Loading collections...")}
                                </p>
                              ) : null}
                              {collectionsState.status === "error" ? (
                                <p className="text-xs text-destructive">
                                  {t(
                                    collectionsState.error ??
                                      "We couldn't load your collections."
                                  )}
                                </p>
                              ) : null}
                              {collectionsState.status === "ready" ? (
                                <p
                                  className={`text-xs ${
                                    isMovingToAnotherCollection
                                      ? "text-brand"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {isMovingToAnotherCollection
                                    ? t("This item will be moved when you save changes.")
                                    : t("Choose where this item belongs.")}
                                </p>
                              ) : null}
                            </div>
                            {actions}
                          </>
                        )}
                      </div>
                    </Card>

                    <ImageGallery
                      itemId={itemId ?? null}
                      disabled={itemState.status !== "ready"}
                      refreshToken={imageRefreshToken}
                      editable={isEditing}
                    />

                    <ImageUploader
                      itemId={itemId ?? null}
                      disabled={itemState.status !== "ready"}
                      onUploaded={handleImageUploaded}
                    />
                  </div>

                  <div className="space-y-6">
                    <Card>
                      {fieldsState.status === "loading" ? (
                        <EmptyState size="sm">
                          {t("Loading schema fields...")}
                        </EmptyState>
                      ) : fieldsState.status === "error" ? (
                        <Alert>
                          {t(
                            fieldsState.error ??
                              "We couldn't load schema fields. Metadata may be incomplete."
                          )}
                        </Alert>
                      ) : isMovingToAnotherCollection ? (
                        <div className="rounded-2xl border border-brand-border bg-brand-muted/70 p-4 text-sm text-brand-strong">
                          <p>{t("Move preview")}</p>
                          {movePreviewError ? <p role="alert">{t(movePreviewError)}</p> : !movePreview ? <p>{t("Loading...")}</p> : (
                            <div className="mt-2 space-y-2">
                              <p>{t("Fields transferred")}: {movePreview.transferred_fields.join(", ") || "—"}</p>
                              <p>{t("Values preserved privately")}: {movePreview.preserved_fields.join(", ") || "—"}</p>
                              {movePreview.missing_fields.length > 0 && <p>{t("Required fields to complete")}: {movePreview.missing_fields.join(", ")}</p>}
                              {movePreview.will_be_draft && <p>{t("The moved item will be a private draft until you review and save it.")}</p>}
                            </div>
                          )}
                        </div>
                      ) : (
                        metadataFields
                      )}
                    </Card>

                    <Alert className="rounded-3xl p-6 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <Eyebrow className="text-destructive">
                            {t("Danger zone")}
                          </Eyebrow>
                          <SectionHeading as="h3" className="mt-3">
                            {t("Permanently delete this item.")}
                          </SectionHeading>
                          <p className="mt-3 text-sm text-destructive">
                            {t(
                              "This removes the item and any attached imagery. Type {token} to confirm.",
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
                            htmlFor="delete-confirm"
                          >
                            {t("Confirmation phrase")}
                          </label>
                          <input
                            id="delete-confirm"
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
                          onClick={handleDelete}
                        >
                          <Trash2 className="h-4 w-4" />
                          {deleteState.status === "working"
                            ? t("Deleting...")
                            : t("Delete item")}
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
                  </div>
                </div>
              )}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
              <div className="contents lg:block lg:space-y-6">
                <Card className="order-2  lg:order-none">
                  <Eyebrow>
                    {t("Item overview")}
                  </Eyebrow>
                  <div className="mt-6 space-y-6">
                    <p className="text-sm text-muted-strong">
                      {collectionName
                        ? t("Collection: {name}", { name: collectionName })
                        : t("Collection details unavailable.")}
                    </p>

                    {saveMessage ? (
                      <Alert tone="success"
                        role="status">
                        {t(saveMessage)}
                      </Alert>
                    ) : null}

                    <div className="rounded-2xl border border-border bg-background/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Eyebrow>
                            {t("Notes")}
                          </Eyebrow>
                          <p className="mt-2 text-sm text-muted-strong">
                            {itemState.data?.notes ? "" : t("No notes added yet.")}
                          </p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                      </div>
                      {itemState.data?.notes ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm text-muted-strong">
                          {itemState.data.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Card>

                <div className="order-4 lg:order-none">
                  <ImageGallery
                    itemId={itemId ?? null}
                    disabled={itemState.status !== "ready"}
                    refreshToken={imageRefreshToken}
                    editable={false}
                  />
                </div>

                <div className="order-5 lg:order-none">
                  <ImageUploader
                    itemId={itemId ?? null}
                    disabled={itemState.status !== "ready"}
                    onUploaded={handleImageUploaded}
                  />
                </div>
              </div>

              <div className="contents lg:block lg:space-y-6">
                <Card tone="subtle" className="order-1  lg:order-none">
                  <Eyebrow>
                    {t("Item snapshot")}
                  </Eyebrow>
                  <SectionHeading as="h3" className="mt-3">
                    {t("Quick overview")}
                  </SectionHeading>
                  <div className="mt-6 space-y-4 text-sm text-muted-strong">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{t("Created")}</p>
                        <p>{formatDate(itemState.data?.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                        <RefreshCcw className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{t("Updated")}</p>
                        <p>{formatDate(itemState.data?.updated_at)}</p>
                      </div>
                    </div>
                    {itemState.data?.is_highlight ? (
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{t("Spotlight")}</p>
                          <p>{t("Yes")}</p>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                        <Star className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{t("Stars")}</p>
                        <p>{tc(itemState.data?.star_count ?? 0, "{count} star", "{count} stars")}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-strong">
                        <Tag className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {t("Metadata fields")}
                        </p>
                        <p>{tc(sortedFields.length, "{count} schema field", "{count} schema fields")}</p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="order-3  lg:order-none">
                  <Eyebrow>
                    {t("Metadata")}
                  </Eyebrow>
                  <SectionHeading as="h3" className="mt-3">
                    {t("Schema attributes")}
                  </SectionHeading>
                  <p className="mt-3 text-sm text-muted-strong">
                    {t("Review each field captured for this item.")}
                  </p>

                  <div className="mt-6">
                    {fieldsState.status === "loading" ? (
                      <EmptyState size="sm">
                        {t("Loading schema fields...")}
                      </EmptyState>
                    ) : fieldsState.status === "error" ? (
                      <Alert>
                        {t(
                          fieldsState.error ??
                            "We couldn't load schema fields. Metadata may be incomplete."
                        )}
                      </Alert>
                    ) : sortedFields.length === 0 ? (
                      <EmptyState size="sm">
                        {t(
                          "No schema fields yet. Define fields to capture structured metadata for this item."
                        )}
                      </EmptyState>
                    ) : (
                      <div className="grid gap-4">
                        {sortedFields.map((field) => {
                          const rawValue = metadataMap[field.name];
                          const isMissing =
                            rawValue === null ||
                            rawValue === undefined ||
                            rawValue === "";
                          const displayValue = isMissing
                            ? t("Not provided")
                            : formatFieldValue(rawValue, field.field_type);

                          return (
                            <div
                              key={field.id}
                              className="rounded-2xl border border-border bg-card/80 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">
                                  {field.name}
                                </p>
                                <span className="text-xs uppercase tracking-[0.2em] text-muted-subtle">
                                  {fieldTypeLabels[field.field_type] ??
                                    field.field_type}
                                  {field.is_required ? ` · ${t("Required")}` : ""}
                                </span>
                              </div>
                              <p
                                className={`mt-3 text-sm ${
                                  isMissing ? "text-muted-subtle" : "text-muted-strong"
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

                  {(itemState.data?.preserved_metadata?.length ?? 0) > 0 && (
                    <div className="mt-6 rounded-2xl border border-brand-border bg-brand-muted p-4">
                      <h3 className="font-medium">{t("Values preserved privately")}</h3>
                      <p className="mt-2 text-sm">{t("These values are visible only to you. Copy a value into a current field when you want to use it again.")}</p>
                      <dl className="mt-3 space-y-2">
                        {itemState.data?.preserved_metadata?.map((entry, index) => (
                          <div key={index}><dt className="text-sm font-medium">{entry.name}</dt><dd className="break-words text-sm">{formatFieldValue(entry.value)}</dd></div>
                        ))}
                      </dl>
                    </div>
                  )}
                  {additionalMetadata.length > 0 ? (
                    <div className="mt-6 rounded-2xl border border-border bg-background/80 p-4">
                      <Eyebrow>
                        {t("Additional metadata")}
                      </Eyebrow>
                      <div className="mt-3 space-y-2 text-sm text-muted-strong">
                        {additionalMetadata.map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="font-medium text-muted-strong">
                              {key}
                            </span>
                            <span className="text-muted-foreground">
                              {formatFieldValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Card>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

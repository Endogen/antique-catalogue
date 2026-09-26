"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  ShieldAlert,
  Star,
  Trash2
} from "lucide-react";

import { ItemForm, type ItemFormValues } from "@/components/item-form";
import { ImageGallery } from "@/components/image-gallery";
import { ImageUploader } from "@/components/image-uploader";
import { AttributeList, AttributeRow } from "@/components/attribute-list";
import { ItemPhotoViewer } from "@/components/item-photo-viewer";
import { ItemTitleBand } from "@/components/item-title-band";
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
  const item = itemState.status === "ready" ? itemState.data : undefined;

  // Viewing and editing swap the whole layout, so start each at the top.
  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [isEditing]);

  const backLink = (
    <Button variant="ghost" size="sm" className="-ml-3 max-w-full" asChild>
      <Link href={`/collections/${collectionId ?? ""}`}>
        <ArrowLeft className="h-4 w-4 shrink-0" />
        {collectionName ? (
          <span className="truncate">
            {/* Visible as a breadcrumb; announced as the back link it is. */}
            <span className="sr-only">{t("Back to collection")}: </span>
            {collectionName}
          </span>
        ) : (
          <span className="truncate">{t("Back to collection")}</span>
        )}
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      {item ? (
        // One title band for both modes, spanning the full width so the
        // columns below start on the same line. It keeps its height when
        // switching modes, so the photos stay in place.
        <ItemTitleBand
          backLink={backLink}
          name={item.name}
          badge={
            isEditing ? (
              <span className="rounded-full border border-brand-border bg-brand-muted px-2.5 py-0.5 text-xs font-medium text-brand">
                {t("Editing")}
              </span>
            ) : null
          }
          createdAt={item.created_at}
          updatedAt={item.updated_at}
          starCount={item.star_count ?? 0}
          isHighlight={item.is_highlight}
          actions={
            // Edit mode saves and cancels from the pinned bar of the form.
            isEditing ? null : (
              <>
                <Button
                  onClick={() => setIsEditing(true)}
                  disabled={!canEdit}
                  title={!canEdit ? t("Reload schema to edit this item.") : undefined}
                >
                  <Pencil className="h-4 w-4" />
                  {t("Edit item")}
                </Button>
                <Button
                  variant={itemStarred ? "secondary" : "outline"}
                  onClick={handleToggleItemStar}
                  disabled={isUpdatingItemStar}
                >
                  <Star className={`h-4 w-4 ${itemStarred ? "fill-current" : ""}`} />
                  {itemStarred ? t("Starred") : t("Star")}
                </Button>
              </>
            )
          }
        >
          {itemStarError ? (
            <p className="text-sm text-destructive">{t(itemStarError)}</p>
          ) : null}
        </ItemTitleBand>
      ) : (
        backLink
      )}
      {!isEditing && saveMessage ? (
        <Alert tone="success" role="status">
          {t(saveMessage)}
        </Alert>
      ) : null}
      {item?.is_draft && <p role="status" className="rounded-xl bg-brand-muted p-4 text-sm text-brand-strong">{t("This item is a private draft. Complete its fields and save to publish it in this collection.")}</p>}

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
      ) : isEditing ? (
        // Edit mode keeps the view layout: from xl the photos stay on the left
        // and the details on the right become the form, so nothing moves when
        // switching modes. Below xl it is one column, form first. As in view
        // mode only the last row flexes, keeping the right-hand gaps even.
        <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:grid-rows-[auto_1fr] xl:items-start xl:gap-8">
          <ItemForm
            className="xl:col-start-2 xl:row-start-1"
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
              <Card>
                <Eyebrow>
                  {t("Item details")}
                </Eyebrow>
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
                          className="block text-sm font-medium text-muted-strong"
                          htmlFor="destination-collection"
                        >
                          {t("Collection")}
                        </label>
                        <select
                          id="destination-collection"
                          className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-muted-strong shadow-xs transition focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
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
                      {isMovingToAnotherCollection ? (
                        <div className="space-y-4 border-t border-border pt-6">
                          <Eyebrow>
                            {t("Metadata")}
                          </Eyebrow>
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
                        </div>
                      ) : (
                        metadataFields
                      )}
                      {actions}
                    </>
                  )}
                </div>
              </Card>
            )}
          />

          <ImageGallery
            className="xl:col-start-1 xl:row-span-2 xl:row-start-1"
            itemId={itemId ?? null}
            disabled={itemState.status !== "ready"}
            refreshToken={imageRefreshToken}
            editable
            footer={({ hasPhotos }) => (
              <ImageUploader
                itemId={itemId ?? null}
                disabled={itemState.status !== "ready"}
                onUploaded={handleImageUploaded}
                expanded={!hasPhotos}
              />
            )}
          />

          <Alert className="rounded-3xl p-6 shadow-xs xl:col-start-2 xl:row-start-2">
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
                  className="mt-2 w-full rounded-xl border border-destructive-border bg-card px-4 py-3 text-sm text-foreground shadow-xs transition focus:border-destructive-border focus:outline-hidden focus:ring-2 focus:ring-destructive-border"
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
      ) : (
        // One column up to xl. From xl the page reads like an object record:
        // the photo on the left stays in view while notes and attributes on
        // the right scroll. The photo spans both rows, so only the last row
        // is flexible: extra photo height collects below the attributes
        // instead of widening the gap between the panels.
        <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:grid-rows-[auto_1fr] xl:items-start xl:gap-8">
          <ItemPhotoViewer
            className="xl:sticky xl:top-28 xl:col-start-1 xl:row-span-2 xl:row-start-1"
            itemId={Number(itemId)}
            itemName={item?.name ?? ""}
            emptyAction={
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={!canEdit}
              >
                <Pencil className="h-4 w-4" />
                {t("Add photos")}
              </Button>
            }
          />

          <Card className="xl:col-start-2 xl:row-start-1">
            <Eyebrow>
              {t("Notes")}
            </Eyebrow>
            {item?.notes ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {item.notes}
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("No notes added yet.")}
              </p>
            )}
          </Card>

          <Card className="xl:col-start-2 xl:row-start-2">
            <Eyebrow>
              {t("Metadata")}
            </Eyebrow>
            <div className="mt-3">
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
                <AttributeList>
                  {sortedFields.map((field) => {
                    const rawValue = metadataMap[field.name];
                    return (
                      <AttributeRow
                        key={field.id}
                        label={field.name}
                        isPrivate={field.is_private}
                        value={
                          rawValue === null || rawValue === undefined || rawValue === ""
                            ? null
                            : formatFieldValue(rawValue, field.field_type)
                        }
                      />
                    );
                  })}
                </AttributeList>
              )}
            </div>

            {(itemState.data?.preserved_metadata?.length ?? 0) > 0 && (
              <div className="mt-6 rounded-2xl border border-brand-border bg-brand-muted p-4">
                <h3 className="font-medium">{t("Values preserved privately")}</h3>
                <p className="mt-2 text-sm">{t("These values are visible only to you. Copy a value into a current field when you want to use it again.")}</p>
                <dl className="mt-3 space-y-2">
                  {itemState.data?.preserved_metadata?.map((entry, index) => (
                    <div key={index}><dt className="text-sm font-medium">{entry.name}</dt><dd className="wrap-break-word text-sm">{formatFieldValue(entry.value)}</dd></div>
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
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AttributeList, AttributeRow } from "@/components/attribute-list";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { ItemPhotoViewer } from "@/components/item-photo-viewer";
import { ItemTitleBand } from "@/components/item-title-band";
import { PublicHeader } from "@/components/public-header";
import { SocialShareActions } from "@/components/social-share-actions";
import {
  isApiError,
  publicCollectionApi,
  publicItemApi,
  starsApi,
  type CollectionResponse,
  type ItemResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { formatMetadataNumber } from "@/lib/format";
import { Card, EmptyState } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

export default function PublicItemDetailPage() {
  const params = useParams();
  const { isAuthenticated, status: authStatus } = useAuth();
  const { t, locale } = useI18n();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const itemIdParam = Array.isArray(params?.itemId) ? params.itemId[0] : params?.itemId;
  const itemId = itemIdParam ? Number(itemIdParam) : NaN;

  const queryClient = useQueryClient();
  const hasIds = Boolean(collectionId) && Number.isFinite(itemId);

  const collectionQuery = useQuery({
    queryKey: queryKeys.explore.collection(Number(collectionId)),
    queryFn: ({ signal }) => publicCollectionApi.get(collectionId!, { signal }),
    enabled: Boolean(collectionId)
  });
  const itemQuery = useQuery({
    queryKey: queryKeys.explore.item(Number(collectionId), itemId),
    queryFn: ({ signal }) =>
      publicItemApi.get(collectionId!, itemIdParam!, { signal }),
    enabled: hasIds
  });
  const collectionState = toLoadState<CollectionResponse | undefined>(
    collectionQuery,
    "We couldn't load this collection.",
    undefined
  );
  const itemState = toLoadState<ItemResponse | undefined>(
    itemQuery,
    "We couldn't load this item.",
    undefined
  );
  const [itemStarred, setItemStarred] = React.useState(false);
  const [isUpdatingItemStar, setIsUpdatingItemStar] = React.useState(false);
  const [itemStarError, setItemStarError] = React.useState<string | null>(null);

  const showAuthenticatedCtas =
    authStatus === "authenticated" && isAuthenticated;

  const formatMetadataValue = React.useCallback(
    (value: unknown) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "number") {
        return formatMetadataNumber(locale, value);
      }
      if (typeof value === "boolean") {
        return value ? t("Yes") : t("No");
      }
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      if (typeof value === "object") {
        return t("Details");
      }
      return String(value);
    },
    [locale, t]
  );

  const applyItemStarCount = React.useCallback(
    (starCount: number) => {
      queryClient.setQueryData<ItemResponse | undefined>(
        queryKeys.explore.item(Number(collectionId), itemId),
        (previous) =>
          previous ? { ...previous, star_count: starCount } : previous
      );
    },
    [queryClient, collectionId, itemId]
  );

  const { refetch: refetchCollection } = collectionQuery;
  const { refetch: refetchItem } = itemQuery;
  const loadCollection = React.useCallback(() => {
    void refetchCollection();
  }, [refetchCollection]);
  const loadItem = React.useCallback(() => {
    void refetchItem();
  }, [refetchItem]);


  const loadItemStarStatus = React.useCallback(async () => {
    if (!collectionId || !itemIdParam || !showAuthenticatedCtas) {
      setItemStarred(false);
      return;
    }
    try {
      const status = await starsApi.itemStatus(collectionId, itemIdParam);
      setItemStarred(status.starred);
      applyItemStarCount(status.star_count);
    } catch (error) {
      if (!isApiError(error) || error.status !== 404) {
        setItemStarError(
          isApiError(error) ? error.detail : "We couldn't update star status."
        );
      }
    }
  }, [applyItemStarCount, collectionId, itemIdParam, showAuthenticatedCtas]);

  React.useEffect(() => {
    void loadItemStarStatus();
  }, [loadItemStarStatus]);

  const handleRefresh = () => {
    setItemStarError(null);
    void loadCollection();
    void loadItem();
    void loadItemStarStatus();
  };

  const handleToggleItemStar = async () => {
    if (!collectionId || !itemIdParam || !showAuthenticatedCtas || isUpdatingItemStar) {
      return;
    }
    setItemStarError(null);
    setIsUpdatingItemStar(true);
    try {
      const status = itemStarred
        ? await starsApi.unstarItem(collectionId, itemIdParam)
        : await starsApi.starItem(collectionId, itemIdParam);
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

  const metadataEntries = React.useMemo(
    () => Object.entries(itemState.data?.metadata ?? {}),
    [itemState.data?.metadata]
  );

  const item = itemState.status === "ready" ? itemState.data : undefined;
  const collection = collectionState.status === "ready" ? collectionState.data : undefined;
  const itemPath =
    collectionId && itemIdParam ? `/explore/${collectionId}/items/${itemIdParam}` : null;

  const backLink = (
    <Button variant="ghost" size="sm" className="-ml-3 max-w-full" asChild>
      <Link href={`/explore/${collectionId ?? ""}`}>
        <ArrowLeft className="h-4 w-4 shrink-0" />
        {collection ? (
          <span className="truncate">
            {/* Visible as a breadcrumb; announced as the back link it is. */}
            <span className="sr-only">{t("Back to collection")}: </span>
            {collection.name}
          </span>
        ) : (
          <span className="truncate">{t("Back to collection")}</span>
        )}
      </Link>
    </Button>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-amber-300/20 blur-[100px]" />
      <div className="pointer-events-none absolute top-[35%] left-[-8%] h-72 w-72 rounded-full bg-amber-200/25 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-8%] h-80 w-80 rounded-full bg-panel/10 blur-[160px]" />
      <div className="relative z-10">
        <PublicHeader />

        <div className="mx-auto max-w-6xl space-y-6 px-6 pb-16 pt-6 lg:px-12">
          {itemState.status === "loading" ? (
            <>
              {backLink}
              <EmptyState aria-busy="true">{t("Loading item details...")}</EmptyState>
            </>
          ) : itemState.status === "error" || !item ? (
            <>
              {backLink}
              <Alert className="rounded-3xl p-6">
                <p className="text-sm font-medium text-destructive">
                  {t("We hit a snag loading this item.")}
                </p>
                <p className="mt-2 text-sm text-destructive">
                  {t(itemState.error ?? "Please try again.")}
                </p>
                <div className="mt-4">
                  <Button variant="outline" onClick={handleRefresh}>
                    {t("Try again")}
                  </Button>
                </div>
              </Alert>
            </>
          ) : (
            <>
              <ItemTitleBand
                backLink={backLink}
                name={item.name}
                createdAt={item.created_at}
                updatedAt={item.updated_at}
                starCount={item.star_count ?? 0}
                isHighlight={item.is_highlight}
                actions={
                  <>
                    {showAuthenticatedCtas ? (
                      <Button
                        variant={itemStarred ? "secondary" : "outline"}
                        onClick={handleToggleItemStar}
                        disabled={isUpdatingItemStar}
                      >
                        <Star className={`h-4 w-4 ${itemStarred ? "fill-current" : ""}`} />
                        {itemStarred ? t("Starred") : t("Star")}
                      </Button>
                    ) : null}
                    <SocialShareActions
                      path={itemPath}
                      title={item.name}
                      text={item.notes}
                      size="default"
                      className="contents"
                      buttonClassName="grow sm:grow-0"
                      copyFirst
                    />
                  </>
                }
              >
                {itemStarError ? (
                  <p className="text-sm text-destructive">{t(itemStarError)}</p>
                ) : null}
              </ItemTitleBand>

              {/* The same record layout as the owner's item page: the photo
                  stays in view on the left while the details scroll. */}
              <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-8">
                <ItemPhotoViewer
                  className="lg:sticky lg:top-6"
                  itemId={itemId}
                  itemName={item.name}
                />

                <div className="space-y-6">
                  {item.notes?.trim() ? (
                    <Card>
                      <Eyebrow>{t("Notes")}</Eyebrow>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {item.notes}
                      </p>
                    </Card>
                  ) : null}

                  {collection ? (
                    <Card>
                      <Eyebrow>{t("Collection")}</Eyebrow>
                      <Link
                        href={`/explore/${collection.id}`}
                        className="mt-3 block wrap-break-word font-medium text-foreground transition hover:text-brand"
                      >
                        {collection.name}
                      </Link>
                      {collection.owner_username ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("By")}{" "}
                          <Link
                            href={`/profile/${encodeURIComponent(collection.owner_username)}`}
                            className="font-medium text-brand hover:text-brand-strong"
                          >
                            @{collection.owner_username}
                          </Link>
                        </p>
                      ) : null}
                    </Card>
                  ) : null}

                  {metadataEntries.length > 0 ? (
                    <Card>
                      <Eyebrow>{t("Metadata")}</Eyebrow>
                      <div className="mt-3">
                        <AttributeList>
                          {metadataEntries.map(([key, value]) => (
                            <AttributeRow key={key} label={key} value={formatMetadataValue(value)} />
                          ))}
                        </AttributeList>
                      </div>
                    </Card>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

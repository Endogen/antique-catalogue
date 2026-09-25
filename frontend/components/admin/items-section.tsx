"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Crown, Loader2, Sparkles, Trash2, X } from "lucide-react";

import {
  ADMIN_PAGE_SIZE,
  ListState,
  MetaLink,
  Pagination,
  Pill,
  Row,
  RowList,
  SearchField,
  SectionHeader,
  Toolbar,
  adminHref,
  destructiveButtonClassName,
  formatAdminDate,
  useActionError,
  useAdminParams
} from "@/components/admin/admin-ui";
import { useI18n } from "@/components/i18n-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { adminApi, type AdminItemResponse } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function ItemsSection() {
  const { t, tc, locale } = useI18n();
  const confirm = useConfirm();
  const { q, page, collection, setQuery, setPage, setCollection } = useAdminParams();
  const [pending, setPending] = React.useState<number | null>(null);
  const action = useActionError();

  const query = useQuery({
    queryKey: queryKeys.admin.items(page, q, collection),
    queryFn: ({ signal }) =>
      adminApi.items({
        offset: page * ADMIN_PAGE_SIZE,
        limit: ADMIN_PAGE_SIZE,
        q: q || undefined,
        collectionId: collection ?? undefined,
        signal
      }),
    placeholderData: keepPreviousData
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total_count ?? 0;
  // The filter chip names the collection once its items have loaded.
  const collectionName = collection
    ? (items.find((item) => item.collection_id === collection)?.collection_name ??
      t("Collection #{id}", { id: collection }))
    : null;

  const remove = async (item: AdminItemResponse) => {
    const confirmed = await confirm({
      title: t('Delete item "{name}"? This cannot be undone.', { name: item.name }),
      confirmLabel: t("Delete"),
      tone: "destructive"
    });
    if (!confirmed) {
      return;
    }
    setPending(item.id);
    await action.run(() => adminApi.deleteItem(item.id), "Unable to delete item.");
    setPending(null);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("Items")}
        description={t("Review the latest items across all collections and remove entries when needed.")}
      />
      <Toolbar
        summary={
          query.data
            ? q || collection
              ? tc(total, "{count} match", "{count} matches")
              : tc(total, "{count} item", "{count} items")
            : null
        }
      >
        <SearchField
          className="sm:w-96"
          value={q}
          onSearch={setQuery}
          placeholder={t("Search by name, collection, or owner")}
        />
        {collectionName ? (
          <span className="inline-flex h-10 max-w-full items-center gap-1 self-start rounded-full border border-brand-border bg-brand-muted pl-4 pr-1.5 text-sm text-brand sm:self-auto">
            <span className="truncate">
              {t("Collection: {name}", { name: collectionName })}
            </span>
            <button
              type="button"
              onClick={() => setCollection(null)}
              aria-label={t("Show items from all collections")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition hover:bg-brand/15"
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        ) : null}
      </Toolbar>

      {action.error ? <Alert>{t(action.error)}</Alert> : null}

      <ListState
        isPending={query.isPending}
        error={query.error}
        isEmpty={items.length === 0}
        loadingLabel={t("Loading items...")}
        emptyLabel={
          q || collection ? t("No items match this search.") : t("No items available yet.")
        }
      >
        <RowList label={t("Items")}>
          {items.map((item) => (
            <Row
              key={item.id}
              title={item.name}
              badges={
                <>
                  {item.is_featured ? (
                    <Pill tone="brand">
                      <Crown className="h-3 w-3" aria-hidden="true" />
                      {t("Featured")}
                    </Pill>
                  ) : null}
                  {item.is_highlight ? (
                    <Pill tone="brand">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      {t("Spotlight")}
                    </Pill>
                  ) : null}
                </>
              }
              meta={
                <>
                  <MetaLink href={adminHref({ section: "items", collection: item.collection_id })}>
                    {item.collection_name}
                  </MetaLink>
                  <MetaLink href={adminHref({ section: "users", q: item.owner_email })}>
                    {item.owner_email}
                  </MetaLink>
                  <span>{tc(item.image_count, "{count} photo", "{count} photos")}</span>
                  <span>{formatAdminDate(item.created_at, locale)}</span>
                </>
              }
              detail={item.notes}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  className={destructiveButtonClassName}
                  onClick={() => remove(item)}
                  disabled={pending !== null}
                >
                  {pending === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {t("Delete")}
                  <span className="sr-only">: {item.name}</span>
                </Button>
              }
            />
          ))}
        </RowList>
        <Pagination page={page} total={total} onPage={setPage} />
      </ListState>
    </div>
  );
}

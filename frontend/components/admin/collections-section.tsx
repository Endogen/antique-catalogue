"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Crown, ExternalLink, Loader2, Trash2 } from "lucide-react";

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
import { adminApi, type AdminCollectionResponse } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function CollectionsSection() {
  const { t, tc, locale } = useI18n();
  const confirm = useConfirm();
  const { q, page, setQuery, setPage } = useAdminParams();
  const [pending, setPending] = React.useState<number | null>(null);
  const action = useActionError();

  const query = useQuery({
    queryKey: queryKeys.admin.collections(page, q, false),
    queryFn: ({ signal }) =>
      adminApi.collections({
        offset: page * ADMIN_PAGE_SIZE,
        limit: ADMIN_PAGE_SIZE,
        q: q || undefined,
        signal
      }),
    placeholderData: keepPreviousData
  });
  const collections = query.data?.items ?? [];
  const total = query.data?.total_count ?? 0;

  const remove = async (collection: AdminCollectionResponse) => {
    const confirmed = await confirm({
      title: t('Delete collection "{name}"? This permanently removes its items and photos.', {
        name: collection.name
      }),
      confirmLabel: t("Delete"),
      tone: "destructive"
    });
    if (!confirmed) {
      return;
    }
    setPending(collection.id);
    await action.run(
      () => adminApi.deleteCollection(collection.id),
      "Unable to delete collection."
    );
    setPending(null);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("Collections")}
        description={t("Every collection across all users, newest first.")}
      />
      <Toolbar
        summary={
          query.data
            ? q
              ? tc(total, "{count} match", "{count} matches")
              : tc(total, "{count} collection", "{count} collections")
            : null
        }
      >
        <SearchField
          className="sm:w-96"
          value={q}
          onSearch={setQuery}
          placeholder={t("Search by name or owner")}
        />
      </Toolbar>

      {action.error ? <Alert>{t(action.error)}</Alert> : null}

      <ListState
        isPending={query.isPending}
        error={query.error}
        isEmpty={collections.length === 0}
        loadingLabel={t("Loading collections...")}
        emptyLabel={
          q ? t("No collections match this search.") : t("No collections available yet.")
        }
      >
        <RowList label={t("Collections")}>
          {collections.map((collection) => (
            <Row
              key={collection.id}
              title={collection.name}
              badges={
                <>
                  {collection.is_public ? (
                    <Pill tone="success">{t("Public")}</Pill>
                  ) : (
                    <Pill>{t("Private")}</Pill>
                  )}
                  {collection.is_featured ? (
                    <Pill tone="brand">
                      <Crown className="h-3 w-3" aria-hidden="true" />
                      {t("Featured")}
                    </Pill>
                  ) : null}
                </>
              }
              meta={
                <>
                  <MetaLink href={adminHref({ section: "users", q: collection.owner_email })}>
                    {collection.owner_email}
                  </MetaLink>
                  <span>
                    {t("Created {date}", { date: formatAdminDate(collection.created_at, locale) })}
                  </span>
                  <MetaLink href={adminHref({ section: "items", collection: collection.id })}>
                    {t("Show items")}
                  </MetaLink>
                </>
              }
              detail={collection.description}
              actions={
                <>
                  {collection.is_public ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/explore/${collection.id}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        {t("View")}
                        <span className="sr-only">: {collection.name}</span>
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className={destructiveButtonClassName}
                    onClick={() => remove(collection)}
                    disabled={pending !== null}
                  >
                    {pending === collection.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {t("Delete")}
                    <span className="sr-only">: {collection.name}</span>
                  </Button>
                </>
              }
            />
          ))}
        </RowList>
        <Pagination page={page} total={total} onPage={setPage} />
      </ListState>
    </div>
  );
}

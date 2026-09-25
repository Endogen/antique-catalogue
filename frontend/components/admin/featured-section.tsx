"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Crown, Loader2 } from "lucide-react";

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
  formatAdminDate,
  useActionError,
  useAdminParams
} from "@/components/admin/admin-ui";
import { useI18n } from "@/components/i18n-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/typography";
import { adminApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function FeaturedSection() {
  const { t, tc, locale } = useI18n();
  const { q, page, setQuery, setPage } = useAdminParams();
  // -1 stands for clearing the featured collection.
  const [pending, setPending] = React.useState<number | null>(null);
  const action = useActionError();

  const statsQuery = useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: ({ signal }) => adminApi.stats({ signal })
  });
  const query = useQuery({
    queryKey: queryKeys.admin.collections(page, q, true),
    queryFn: ({ signal }) =>
      adminApi.collections({
        offset: page * ADMIN_PAGE_SIZE,
        limit: ADMIN_PAGE_SIZE,
        publicOnly: true,
        q: q || undefined,
        signal
      }),
    placeholderData: keepPreviousData
  });
  const collections = query.data?.items ?? [];
  const total = query.data?.total_count ?? 0;
  const featuredName = statsQuery.data?.featured_collection_name ?? null;

  const feature = async (collectionId: number | null) => {
    setPending(collectionId ?? -1);
    // The write publishes a mutation, which refreshes every admin view.
    await action.run(
      () => adminApi.feature(collectionId),
      "Unable to update featured collection."
    );
    setPending(null);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("Featured collection")}
        description={t("The collection highlighted on the homepage. Only public collections can be featured.")}
      />

      <Card tone={featuredName ? "brand" : "subtle"} padding="none" className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand">
            <Crown className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <Eyebrow>{t("Currently featured")}</Eyebrow>
            <p className="mt-1 wrap-break-word font-display text-xl text-foreground">
              {statsQuery.isPending ? "…" : (featuredName ?? t("No featured collection"))}
            </p>
          </div>
          {featuredName ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href={adminHref({ section: "spotlight" })}>
                  {t("Spotlight items")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => feature(null)}
                disabled={pending !== null}
              >
                {pending === -1 ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("Clear featured")}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <Toolbar
        summary={
          query.data
            ? tc(total, "{count} public collection", "{count} public collections")
            : null
        }
      >
        <SearchField
          className="sm:w-96"
          value={q}
          onSearch={setQuery}
          placeholder={t("Search public collections")}
        />
      </Toolbar>

      {action.error ? <Alert>{t(action.error)}</Alert> : null}

      <ListState
        isPending={query.isPending}
        error={query.error}
        isEmpty={collections.length === 0}
        loadingLabel={t("Loading collections...")}
        emptyLabel={
          q ? t("No collections match this search.") : t("No public collections yet.")
        }
      >
        <RowList label={t("Public collections")}>
          {collections.map((collection) => (
            <Row
              key={collection.id}
              title={collection.name}
              badges={
                collection.is_featured ? (
                  <Pill tone="brand">
                    <Crown className="h-3 w-3" aria-hidden="true" />
                    {t("Featured")}
                  </Pill>
                ) : null
              }
              meta={
                <>
                  <MetaLink href={adminHref({ section: "users", q: collection.owner_email })}>
                    {collection.owner_email}
                  </MetaLink>
                  <span>
                    {t("Created {date}", { date: formatAdminDate(collection.created_at, locale) })}
                  </span>
                </>
              }
              detail={collection.description}
              actions={
                collection.is_featured ? null : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => feature(collection.id)}
                    disabled={pending !== null}
                  >
                    {pending === collection.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {t("Feature")}
                  </Button>
                )
              }
            />
          ))}
        </RowList>
        <Pagination page={page} total={total} onPage={setPage} />
      </ListState>
    </div>
  );
}

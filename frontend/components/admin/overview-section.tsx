"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Crown, FolderOpen, Package, Users } from "lucide-react";

import {
  type AdminSection,
  ListState,
  Pill,
  Row,
  RowList,
  SearchField,
  SectionHeader,
  adminHref,
  formatAdminDate,
  useAdminParams
} from "@/components/admin/admin-ui";
import { useI18n } from "@/components/i18n-provider";
import { Eyebrow } from "@/components/ui/typography";
import { adminApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const PREVIEW_SIZE = 5;

function StatTile({
  href,
  icon: Icon,
  label,
  value,
  hint
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col rounded-3xl border border-border bg-card/90 p-4 shadow-xs sm:p-5 transition hover:border-brand-border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center justify-between gap-3">
        <Eyebrow className="truncate">{label}</Eyebrow>
        <Icon className="h-4 w-4 text-muted-subtle transition group-hover:text-brand" />
      </span>
      <span className="mt-3 min-w-0 truncate font-display text-3xl text-foreground sm:mt-4">{value}</span>
      <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground sm:text-sm transition group-hover:text-foreground">
        {hint}
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/** A titled group of up to five records with a link to the full section. */
function Preview({
  title,
  section,
  q,
  total,
  children,
  isPending,
  error,
  isEmpty,
  emptyLabel
}: {
  title: string;
  section: AdminSection;
  q: string;
  total: number | undefined;
  children: React.ReactNode;
  isPending: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyLabel: string;
}) {
  const { t } = useI18n();
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          {title}
          {typeof total === "number" ? (
            <span className="ml-2 font-normal tabular-nums text-muted-foreground">{total}</span>
          ) : null}
        </h2>
        {total ? (
          <Link
            href={adminHref({ section, q })}
            className="inline-flex items-center gap-1 text-sm text-muted-strong transition hover:text-foreground"
          >
            {t("Show all")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <ListState
        isPending={isPending}
        error={error}
        isEmpty={isEmpty}
        loadingLabel={t("Loading...")}
        emptyLabel={emptyLabel}
      >
        {children}
      </ListState>
    </section>
  );
}

export function OverviewSection() {
  const { t, locale } = useI18n();
  const { q, setQuery } = useAdminParams();
  const search = q || undefined;

  const statsQuery = useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: ({ signal }) => adminApi.stats({ signal })
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users(0, q, PREVIEW_SIZE),
    queryFn: ({ signal }) => adminApi.users({ limit: PREVIEW_SIZE, q: search, signal }),
    placeholderData: keepPreviousData
  });
  const collectionsQuery = useQuery({
    queryKey: queryKeys.admin.collections(0, q, false, PREVIEW_SIZE),
    queryFn: ({ signal }) => adminApi.collections({ limit: PREVIEW_SIZE, q: search, signal }),
    placeholderData: keepPreviousData,
    enabled: Boolean(q)
  });
  const itemsQuery = useQuery({
    queryKey: queryKeys.admin.items(0, q, null, PREVIEW_SIZE),
    queryFn: ({ signal }) => adminApi.items({ limit: PREVIEW_SIZE, q: search, signal }),
    placeholderData: keepPreviousData
  });
  const stats = statsQuery.data;

  const users = usersQuery.data?.items ?? [];
  const collections = collectionsQuery.data?.items ?? [];
  const items = itemsQuery.data?.items ?? [];

  const usersPreview = (
    <Preview
      title={q ? t("Users") : t("Newest users")}
      section="users"
      q={q}
      total={q ? usersQuery.data?.total_count : undefined}
      isPending={usersQuery.isPending}
      error={usersQuery.error}
      isEmpty={users.length === 0}
      emptyLabel={q ? t("No users match this search.") : t("No users available yet.")}
    >
      <RowList label={t("Users")}>
        {users.map((user) => (
          <Row
            key={user.id}
            title={
              <Link href={adminHref({ section: "users", q: user.email })} className="hover:underline">
                {user.email}
              </Link>
            }
            badges={user.is_active ? null : <Pill tone="destructive">{t("Locked")}</Pill>}
            meta={
              <>
                <span>@{user.username}</span>
                <span>{t("Joined {date}", { date: formatAdminDate(user.created_at, locale) })}</span>
              </>
            }
          />
        ))}
      </RowList>
    </Preview>
  );

  const itemsPreview = (
    <Preview
      title={q ? t("Items") : t("Newest items")}
      section="items"
      q={q}
      total={q ? itemsQuery.data?.total_count : undefined}
      isPending={itemsQuery.isPending}
      error={itemsQuery.error}
      isEmpty={items.length === 0}
      emptyLabel={q ? t("No items match this search.") : t("No items available yet.")}
    >
      <RowList label={t("Items")}>
        {items.map((item) => (
          <Row
            key={item.id}
            title={
              <Link href={adminHref({ section: "items", q: item.name })} className="hover:underline">
                {item.name}
              </Link>
            }
            meta={
              <>
                <span>{item.collection_name}</span>
                <span>{item.owner_email}</span>
              </>
            }
          />
        ))}
      </RowList>
    </Preview>
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        title={t("Overview")}
        description={t("Monitor platform activity, moderate users, and curate featured content.")}
      />
      <SearchField
        value={q}
        onSearch={setQuery}
        placeholder={t("Search users, collections, items")}
      />

      {q ? (
        <div className="space-y-8">
          {usersPreview}
          <Preview
            title={t("Collections")}
            section="collections"
            q={q}
            total={collectionsQuery.data?.total_count}
            isPending={collectionsQuery.isPending}
            error={collectionsQuery.error}
            isEmpty={collections.length === 0}
            emptyLabel={t("No collections match this search.")}
          >
            <RowList label={t("Collections")}>
              {collections.map((collection) => (
                <Row
                  key={collection.id}
                  title={
                    <Link
                      href={adminHref({ section: "collections", q: collection.name })}
                      className="hover:underline"
                    >
                      {collection.name}
                    </Link>
                  }
                  badges={collection.is_public ? null : <Pill>{t("Private")}</Pill>}
                  meta={<span>{collection.owner_email}</span>}
                />
              ))}
            </RowList>
          </Preview>
          {itemsPreview}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatTile
              href={adminHref({ section: "users" })}
              icon={Users}
              label={t("Users")}
              value={stats?.total_users ?? "–"}
              hint={t("Manage accounts")}
            />
            <StatTile
              href={adminHref({ section: "collections" })}
              icon={FolderOpen}
              label={t("Collections")}
              value={stats?.total_collections ?? "–"}
              hint={t("Review collections")}
            />
            <StatTile
              href={adminHref({ section: "items" })}
              icon={Package}
              label={t("Items")}
              value={stats?.total_items ?? "–"}
              hint={t("Moderate items")}
            />
            <StatTile
              href={adminHref({ section: "featured" })}
              icon={Crown}
              label={t("Featured")}
              value={
                stats ? (
                  stats.featured_collection_name ? (
                    <span className="text-xl sm:text-2xl">{stats.featured_collection_name}</span>
                  ) : (
                    "–"
                  )
                ) : (
                  "–"
                )
              }
              hint={stats?.featured_collection_name ? t("Change") : t("Choose collection")}
            />
          </div>
          <div className="grid gap-8 xl:grid-cols-2 xl:gap-6">
            {usersPreview}
            {itemsPreview}
          </div>
        </>
      )}
    </div>
  );
}

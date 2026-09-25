"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, Lock, LockOpen, Trash2 } from "lucide-react";

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
import { adminApi, type AdminUserResponse } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function UsersSection() {
  const { t, tc, locale } = useI18n();
  const confirm = useConfirm();
  const { q, page, setQuery, setPage } = useAdminParams();
  const [pending, setPending] = React.useState<{ id: number; kind: "lock" | "delete" } | null>(
    null
  );
  const action = useActionError();

  const query = useQuery({
    queryKey: queryKeys.admin.users(page, q),
    queryFn: ({ signal }) =>
      adminApi.users({ offset: page * ADMIN_PAGE_SIZE, limit: ADMIN_PAGE_SIZE, q: q || undefined, signal }),
    placeholderData: keepPreviousData
  });
  const users = query.data?.items ?? [];
  const total = query.data?.total_count ?? 0;

  const toggleLock = async (user: AdminUserResponse) => {
    setPending({ id: user.id, kind: "lock" });
    await action.run(
      () => adminApi.setUserLocked(user.id, user.is_active),
      "Unable to update user lock status."
    );
    setPending(null);
  };

  const remove = async (user: AdminUserResponse) => {
    const confirmed = await confirm({
      title: t('Delete user "{email}"? This permanently removes their collections and items.', {
        email: user.email
      }),
      confirmLabel: t("Delete"),
      tone: "destructive"
    });
    if (!confirmed) {
      return;
    }
    setPending({ id: user.id, kind: "delete" });
    await action.run(() => adminApi.deleteUser(user.id), "Unable to delete user.");
    setPending(null);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("Users")}
        description={t("Review users, lock access, or remove accounts and their catalogue data.")}
      />
      <Toolbar
        summary={
          query.data
            ? q
              ? tc(total, "{count} match", "{count} matches")
              : tc(total, "{count} user", "{count} users")
            : null
        }
      >
        <SearchField
          className="sm:w-96"
          value={q}
          onSearch={setQuery}
          placeholder={t("Search by email or username")}
        />
      </Toolbar>

      {action.error ? <Alert>{t(action.error)}</Alert> : null}

      <ListState
        isPending={query.isPending}
        error={query.error}
        isEmpty={users.length === 0}
        loadingLabel={t("Loading users...")}
        emptyLabel={q ? t("No users match this search.") : t("No users available yet.")}
      >
        <RowList label={t("Users")}>
          {users.map((user) => {
            const busy = pending?.id === user.id ? pending.kind : null;
            return (
              <Row
                key={user.id}
                leading={
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-muted font-display text-base text-brand"
                  >
                    {(user.username || user.email).charAt(0).toUpperCase()}
                  </span>
                }
                title={user.email}
                badges={
                  <>
                    {user.is_active ? null : <Pill tone="destructive">{t("Locked")}</Pill>}
                    {user.is_verified ? null : <Pill>{t("Unverified")}</Pill>}
                  </>
                }
                meta={
                  <>
                    <span>@{user.username}</span>
                    <span>{t("Joined {date}", { date: formatAdminDate(user.created_at, locale) })}</span>
                    <MetaLink href={adminHref({ section: "collections", q: user.email })}>
                      {tc(user.collection_count, "{count} collection", "{count} collections")}
                    </MetaLink>
                    <MetaLink href={adminHref({ section: "items", q: user.email })}>
                      {tc(user.item_count, "{count} item", "{count} items")}
                    </MetaLink>
                  </>
                }
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleLock(user)}
                      disabled={pending !== null}
                    >
                      {busy === "lock" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : user.is_active ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        <LockOpen className="h-4 w-4" />
                      )}
                      {user.is_active ? t("Lock") : t("Unlock")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={destructiveButtonClassName}
                      onClick={() => remove(user)}
                      disabled={pending !== null}
                    >
                      {busy === "delete" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {t("Delete")}
                      <span className="sr-only">: {user.email}</span>
                    </Button>
                  </>
                }
              />
            );
          })}
        </RowList>
        <Pagination page={page} total={total} onPage={setPage} />
      </ListState>
    </div>
  );
}

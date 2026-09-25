"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, ImageIcon, Loader2 } from "lucide-react";

import {
  ListState,
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
import { EmptyState } from "@/components/ui/card";
import { adminApi, imageApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const MAX_FEATURED_ITEMS = 4;

function Thumbnail({ imageId }: { imageId: number | null | undefined }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-subtle">
      {imageId && !failed ? (
        // The featured collection is public, so its photos load without a session.
        <Image
          src={imageApi.url(imageId, "thumb")}
          alt=""
          width={96}
          height={96}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          unoptimized
        />
      ) : (
        <ImageIcon className="h-5 w-5" aria-hidden="true" />
      )}
    </span>
  );
}

export function SpotlightSection() {
  const { t, locale } = useI18n();
  const { q, setQuery } = useAdminParams();
  const action = useActionError();
  const [selection, setSelection] = React.useState<number[]>([]);
  const [pending, setPending] = React.useState<number | null>(null);

  const statsQuery = useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: ({ signal }) => adminApi.stats({ signal })
  });
  const featuredId = statsQuery.data?.featured_collection_id ?? null;
  const itemsQuery = useQuery({
    queryKey: queryKeys.admin.featuredItems(),
    queryFn: ({ signal }) => adminApi.featuredItems({ signal }),
    enabled: Boolean(featuredId)
  });

  // Follow the server whenever its list changes.
  const data = itemsQuery.data;
  React.useEffect(() => {
    if (data) {
      setSelection(data.filter((item) => item.is_featured).map((item) => item.id));
    }
  }, [data]);

  // The featured collection's items all arrive at once, so search filters them here.
  const term = q.toLocaleLowerCase();
  const items = (data ?? []).filter(
    (item) =>
      !term ||
      item.name.toLocaleLowerCase().includes(term) ||
      (item.notes ?? "").toLocaleLowerCase().includes(term)
  );
  const full = selection.length >= MAX_FEATURED_ITEMS;

  const toggle = async (itemId: number) => {
    if (pending !== null) {
      return;
    }
    const previous = selection;
    const next = previous.includes(itemId)
      ? previous.filter((id) => id !== itemId)
      : [...previous, itemId];
    if (next.length > MAX_FEATURED_ITEMS) {
      return;
    }
    setPending(itemId);
    setSelection(next);
    const saved = await action.run(
      () => adminApi.setFeaturedItems(next),
      "Unable to update featured items."
    );
    if (!saved) {
      setSelection(previous);
    }
    setPending(null);
  };

  const counter = (
    <div
      className="flex items-center gap-3 rounded-full border border-border bg-card/90 py-2 pl-4 pr-3 text-sm text-muted-strong shadow-xs"
      aria-live="polite"
    >
      {t("{selected} of {count} selected", {
        selected: selection.length,
        count: MAX_FEATURED_ITEMS
      })}
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: MAX_FEATURED_ITEMS }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-2 w-2 rounded-full transition",
              index < selection.length ? "bg-brand" : "bg-border"
            )}
          />
        ))}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("Spotlight items")}
        description={t("Select up to {count} items from the featured collection to spotlight on the homepage.", {
          count: MAX_FEATURED_ITEMS
        })}
        aside={featuredId ? counter : null}
      />

      {statsQuery.isPending ? null : !featuredId ? (
        <EmptyState size="sm" className="flex flex-wrap items-center justify-between gap-3">
          {t("Choose a featured collection to manage highlighted items.")}
          <Button size="sm" variant="outline" asChild>
            <Link href={adminHref({ section: "featured" })}>{t("Choose collection")}</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <Toolbar
            summary={
              data
                ? t("From {name}", { name: statsQuery.data?.featured_collection_name ?? "" })
                : null
            }
          >
            <SearchField
              className="sm:w-96"
              value={q}
              onSearch={setQuery}
              placeholder={t("Search items by name or notes")}
            />
          </Toolbar>

          {action.error ? <Alert>{t(action.error)}</Alert> : null}

          <ListState
            isPending={itemsQuery.isPending}
            error={itemsQuery.error}
            isEmpty={items.length === 0}
            loadingLabel={t("Loading featured items...")}
            emptyLabel={q ? t("No items match this search.") : t("No items yet in this collection.")}
          >
            <RowList label={t("Spotlight items")}>
              {items.map((item) => {
                const selected = selection.includes(item.id);
                return (
                  <Row
                    key={item.id}
                    leading={<Thumbnail imageId={item.primary_image_id} />}
                    title={item.name}
                    meta={
                      <span>
                        {t("Added {date}", { date: formatAdminDate(item.created_at, locale) })}
                      </span>
                    }
                    detail={item.notes}
                    actions={
                      <Button
                        size="sm"
                        variant={selected ? "brand" : "outline"}
                        aria-pressed={selected}
                        onClick={() => toggle(item.id)}
                        disabled={pending !== null || (!selected && full)}
                        title={!selected && full ? t("Remove an item first to pick another.") : undefined}
                      >
                        {pending === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : selected ? (
                          <Check className="h-4 w-4" />
                        ) : null}
                        {selected ? t("Featured") : t("Feature")}
                        <span className="sr-only">: {item.name}</span>
                      </Button>
                    }
                  />
                );
              })}
            </RowList>
          </ListState>
        </>
      )}
    </div>
  );
}

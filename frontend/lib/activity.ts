import type { ActivityLogResponse } from "@/lib/api";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const ACTION_LABELS: Record<string, string> = {
  "collection.created": "Collection created",
  "collection.updated": "Collection updated",
  "collection.deleted": "Collection deleted",
  "collection.starred": "Collection starred",
  "item.created": "Item created",
  "item.updated": "Item updated",
  "item.deleted": "Item deleted",
  "item.starred": "Item starred",
  "profile.username_updated": "Username updated",
  "profile.avatar_updated": "Avatar updated",
  "profile.avatar_removed": "Avatar removed",
  "schema_template.created": "Schema template created",
  "schema_template.copied": "Schema template copied",
  "schema_template.updated": "Schema template updated",
  "schema_template.deleted": "Schema template deleted"
};

const formatActionType = (value: string) => value.replace(/[._-]+/g, " ");

export const activityActionLabel = (entry: ActivityLogResponse, t: Translate): string => {
  const label = ACTION_LABELS[entry.action_type];
  return label ? t(label) : formatActionType(entry.action_type);
};

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

/**
 * Build a localized summary from the entry's structured context. Entries
 * written before context existed (or with unknown action types) fall back
 * to the stored English summary.
 */
export const describeActivity = (entry: ActivityLogResponse, t: Translate): string => {
  const ctx = entry.context ?? {};
  const collection = asString(ctx["collection_name"]);
  const item = asString(ctx["item_name"]);
  const template = asString(ctx["template_name"]);
  const actor = asString(ctx["actor_username"]);

  switch (entry.action_type) {
    case "collection.created":
      if (collection && template) {
        return t('Created collection "{name}" from template "{template}".', {
          name: collection,
          template
        });
      }
      if (collection) {
        return t('Created collection "{name}".', { name: collection });
      }
      break;
    case "collection.updated":
      if (collection && template) {
        return t('Applied schema template "{template}" to collection "{name}".', {
          name: collection,
          template
        });
      }
      if (collection) {
        return t('Updated collection "{name}".', { name: collection });
      }
      break;
    case "collection.deleted":
      if (collection) {
        return t('Deleted collection "{name}".', { name: collection });
      }
      break;
    case "collection.starred":
      if (actor && collection) {
        return t('@{username} starred your collection "{name}".', {
          username: actor,
          name: collection
        });
      }
      if (collection) {
        return t('Starred collection "{name}".', { name: collection });
      }
      break;
    case "item.created":
      if (item && collection && ctx["via"] === "speed_capture") {
        return t('Speed capture: created draft "{item}" in "{collection}".', {
          item,
          collection
        });
      }
      if (item && collection) {
        return t('Created item "{item}" in "{collection}".', { item, collection });
      }
      break;
    case "item.updated": {
      const from = asString(ctx["from_collection_name"]);
      const to = asString(ctx["to_collection_name"]);
      if (item && from && to) {
        return t('Moved item "{item}" from "{from}" to "{to}".', { item, from, to });
      }
      if (item && collection) {
        return t('Updated item "{item}" in "{collection}".', { item, collection });
      }
      break;
    }
    case "item.deleted":
      if (item && collection) {
        return t('Deleted item "{item}" from "{collection}".', { item, collection });
      }
      break;
    case "item.starred":
      if (actor && item) {
        return t('@{username} starred your item "{item}".', { username: actor, item });
      }
      if (item && collection) {
        return t('Starred item "{item}" in "{collection}".', { item, collection });
      }
      break;
    case "profile.username_updated": {
      const username = asString(ctx["username"]);
      if (username) {
        return t('Updated username to "{username}".', { username });
      }
      break;
    }
    case "profile.avatar_updated":
      return t("Updated profile avatar.");
    case "profile.avatar_removed":
      return t("Removed profile avatar.");
    case "schema_template.created":
      if (template) {
        return t('Created schema template "{template}".', { template });
      }
      break;
    case "schema_template.copied": {
      const source = asString(ctx["source_template_name"]);
      if (source && template) {
        return t('Copied schema template "{source}" to "{template}".', {
          source,
          template
        });
      }
      break;
    }
    case "schema_template.updated":
      if (template) {
        return t('Updated schema template "{template}".', { template });
      }
      break;
    case "schema_template.deleted":
      if (template) {
        return t('Deleted schema template "{template}".', { template });
      }
      break;
  }

  return entry.summary;
};

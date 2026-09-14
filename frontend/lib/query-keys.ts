/**
 * Central query-key factory.
 *
 * Keeping keys here means a mutation can invalidate exactly the views that show
 * the changed resource, without each page inventing its own key shape.
 */
export const queryKeys = {
  collections: {
    all: ["collections"] as const,
    list: () => ["collections", "list"] as const,
    detail: (id: number) => ["collections", "detail", id] as const,
    fields: (id: number) => ["collections", "fields", id] as const,
    items: (id: number) => ["collections", "items", id] as const
  },
  items: {
    all: ["items"] as const,
    detail: (id: number) => ["items", "detail", id] as const,
    images: (id: number) => ["items", "images", id] as const
  },
  search: {
    items: (term: string) => ["search", "items", term] as const
  },
  stars: {
    collections: () => ["stars", "collections"] as const,
    items: () => ["stars", "items"] as const
  },
  schemaTemplates: {
    all: ["schema-templates"] as const,
    list: () => ["schema-templates", "list"] as const,
    detail: (id: number) => ["schema-templates", "detail", id] as const,
    fields: (source: string) => ["schema-templates", "fields", source] as const
  },
  profile: {
    me: () => ["profile", "me"] as const,
    public: (username: string) => ["profile", "public", username] as const,
    publicCollections: (username: string) =>
      ["profile", "public-collections", username] as const
  },
  activity: {
    list: (limit: number) => ["activity", "list", limit] as const
  },
  explore: {
    list: (query: string) => ["explore", "list", query] as const,
    featured: () => ["explore", "featured"] as const,
    featuredItems: () => ["explore", "featured-items"] as const,
    collection: (id: number) => ["explore", "collection", id] as const,
    collectionItems: (id: number) => ["explore", "collection-items", id] as const,
    item: (collectionId: number, itemId: number) =>
      ["explore", "item", collectionId, itemId] as const
  },
  admin: {
    all: ["admin"] as const,
    stats: () => ["admin", "stats"] as const,
    collections: (page: number) => ["admin", "collections", page] as const,
    users: (page: number, query: string) => ["admin", "users", page, query] as const,
    items: (page: number, query: string) => ["admin", "items", page, query] as const,
    featuredItems: () => ["admin", "featured-items"] as const
  }
} as const;

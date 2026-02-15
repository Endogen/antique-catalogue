export type MessageResponse = {
  message: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type UserResponse = {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type CollectionResponse = {
  id: number;
  name: string;
  description: string | null;
  owner_username?: string | null;
  is_public: boolean;
  is_featured?: boolean;
  item_count?: number | null;
  star_count?: number | null;
  created_at: string;
  updated_at: string;
};

export type CollectionCreatePayload = {
  name: string;
  description?: string | null;
  is_public?: boolean;
  schema_template_id?: number | null;
};

export type CollectionUpdatePayload = {
  name?: string;
  description?: string | null;
  is_public?: boolean;
};

export type FieldOptions = {
  options: string[];
};

export type FieldDefinitionResponse = {
  id: number;
  collection_id: number;
  name: string;
  field_type: string;
  is_required: boolean;
  is_private: boolean;
  options: FieldOptions | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type FieldDefinitionCreatePayload = {
  name: string;
  field_type: string;
  is_required?: boolean;
  is_private?: boolean;
  options?: FieldOptions | null;
};

export type FieldDefinitionUpdatePayload = {
  name?: string;
  field_type?: string;
  is_required?: boolean;
  is_private?: boolean;
  options?: FieldOptions | null;
};

export type SchemaTemplateFieldResponse = {
  id: number;
  schema_template_id: number;
  name: string;
  field_type: string;
  is_required: boolean;
  is_private: boolean;
  options: FieldOptions | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type SchemaTemplateSummaryResponse = {
  id: number;
  name: string;
  field_count: number;
  created_at: string;
  updated_at: string;
};

export type SchemaTemplateResponse = SchemaTemplateSummaryResponse & {
  fields: SchemaTemplateFieldResponse[];
};

export type SchemaTemplateCreatePayload = {
  name: string;
  fields?: FieldDefinitionCreatePayload[];
};

export type SchemaTemplateUpdatePayload = {
  name?: string;
  fields?: FieldDefinitionCreatePayload[];
};

export type SchemaTemplateCopyPayload = {
  name?: string;
};

export type ItemResponse = {
  id: number;
  collection_id: number;
  name: string;
  owner_username?: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  primary_image_id?: number | null;
  image_count?: number | null;
  star_count?: number | null;
  is_highlight: boolean;
  created_at: string;
  updated_at: string;
};

export type FeaturedItemResponse = {
  id: number;
  collection_id: number;
  name: string;
  owner_username?: string | null;
  notes: string | null;
  primary_image_id?: number | null;
  is_highlight: boolean;
  created_at: string;
};

export type PublicProfileResponse = {
  id: number;
  username: string;
  created_at: string;
  public_collection_count: number;
  public_item_count: number;
  earned_star_count: number;
  star_rank: number;
};

export type ItemImageResponse = {
  id: number;
  item_id: number;
  filename: string;
  position: number;
  created_at: string;
};

export type ItemCreatePayload = {
  name: string;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
  is_highlight?: boolean;
};

export type ItemUpdatePayload = {
  name?: string;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
  is_highlight?: boolean;
};

export type ItemImageUpdatePayload = {
  position: number;
};

export type ItemListOptions = {
  search?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  filters?: string[];
};

export type ItemSearchResponse = {
  id: number;
  collection_id: number;
  collection_name: string;
  name: string;
  notes: string | null;
  primary_image_id?: number | null;
  image_count?: number | null;
  is_highlight: boolean;
  created_at: string;
  updated_at: string;
};

export type ActivityLogResponse = {
  id: number;
  action_type: string;
  resource_type: string;
  resource_id: number | null;
  target_path?: string | null;
  summary: string;
  created_at: string;
};

export type StarStatusResponse = {
  starred: boolean;
  star_count: number;
};

export type StarredCollectionResponse = {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  item_count: number;
  star_count: number;
  starred_at: string;
  target_path: string;
  created_at: string;
  updated_at: string;
};

export type StarredItemResponse = {
  id: number;
  collection_id: number;
  collection_name: string;
  name: string;
  notes: string | null;
  primary_image_id?: number | null;
  image_count: number;
  star_count: number;
  is_highlight: boolean;
  starred_at: string;
  target_path: string;
  created_at: string;
  updated_at: string;
};

export type ApiErrorPayload = {
  detail?: string;
  message?: string;
  errors?: unknown;
};

export type AdminTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type AdminStatsResponse = {
  total_users: number;
  total_collections: number;
  featured_collection_id: number | null;
};

export type AdminCollectionResponse = {
  id: number;
  owner_id: number;
  owner_email: string;
  name: string;
  description: string | null;
  is_public: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminCollectionListResponse = {
  total_count: number;
  items: AdminCollectionResponse[];
};

export type AdminUserResponse = {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_verified: boolean;
  collection_count: number;
  item_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminUserListResponse = {
  total_count: number;
  items: AdminUserResponse[];
};

export type AdminFeaturedItemResponse = {
  id: number;
  collection_id: number;
  name: string;
  notes: string | null;
  primary_image_id?: number | null;
  is_featured: boolean;
  created_at: string;
};

export type AdminItemResponse = {
  id: number;
  collection_id: number;
  collection_name: string;
  owner_id: number;
  owner_email: string;
  name: string;
  notes: string | null;
  is_featured: boolean;
  is_highlight: boolean;
  image_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminItemListResponse = {
  total_count: number;
  items: AdminItemResponse[];
};

const RAW_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "";
const API_BASE_URL =
  RAW_API_BASE_URL && RAW_API_BASE_URL.trim() ? RAW_API_BASE_URL : "/api";

const ACCESS_TOKEN_STORAGE_KEY = "antique_access_token";
const ADMIN_TOKEN_STORAGE_KEY = "antique_admin_token";

let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

const isBrowser = () => typeof window !== "undefined";

const isFormData = (body: unknown): body is FormData =>
  typeof FormData !== "undefined" && body instanceof FormData;

const isBlob = (body: unknown): body is Blob =>
  typeof Blob !== "undefined" && body instanceof Blob;

const isArrayBuffer = (body: unknown): body is ArrayBuffer =>
  typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer;

const isUrlSearchParams = (body: unknown): body is URLSearchParams =>
  typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams;

const isBodyInit = (body: unknown): body is BodyInit =>
  typeof body === "string" ||
  isFormData(body) ||
  isBlob(body) ||
  isArrayBuffer(body) ||
  isUrlSearchParams(body);

const storageGet = (key: string): string | null => {
  if (!isBrowser()) {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const storageSet = (key: string, value: string | null) => {
  if (!isBrowser()) {
    return;
  }
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage failures (private mode, disabled storage, etc.)
  }
};

export class ApiError extends Error {
  status: number;
  detail: string;
  errors?: unknown;

  constructor(status: number, detail: string, errors?: unknown) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.errors = errors;
  }
}

export const isApiError = (value: unknown): value is ApiError =>
  value instanceof ApiError;

export const getAccessToken = (): string | null => {
  if (inMemoryAccessToken) {
    return inMemoryAccessToken;
  }
  const stored = storageGet(ACCESS_TOKEN_STORAGE_KEY);
  if (stored) {
    inMemoryAccessToken = stored;
  }
  return inMemoryAccessToken;
};

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
  storageSet(ACCESS_TOKEN_STORAGE_KEY, token);
};

export const getAdminToken = (): string | null => storageGet(ADMIN_TOKEN_STORAGE_KEY);

export const setAdminToken = (token: string | null) => {
  storageSet(ADMIN_TOKEN_STORAGE_KEY, token);
};

export const buildApiUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
};

const parseErrorPayload = async (response: Response): Promise<ApiError> => {
  let detail = response.statusText || "Request failed";
  let errors: unknown;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await response.json()) as ApiErrorPayload;
    if (data?.detail) {
      detail = data.detail;
    } else if (data?.message) {
      detail = data.message;
    }
    errors = data?.errors;
  } else {
    const text = await response.text();
    if (text) {
      detail = text;
    }
  }

  return new ApiError(response.status, detail, errors);
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw await parseErrorPayload(response);
  }

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  const trimmed = text.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      // Fall through to return raw text.
    }
  }

  return text as T;
};

const buildItemListQuery = (options?: ItemListOptions) => {
  if (!options) {
    return "";
  }

  const params = new URLSearchParams();
  if (options.search) {
    params.set("search", options.search);
  }
  if (options.sort) {
    params.set("sort", options.sort);
  }
  if (typeof options.offset === "number") {
    params.set("offset", String(options.offset));
  }
  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (options.filters?.length) {
    options.filters
      .map((filter) => filter.trim())
      .filter(Boolean)
      .forEach((filter) => params.append("filter", filter));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
};

const buildStarsListQuery = (options: {
  q?: string;
  limit?: number;
  offset?: number;
}) => {
  const params = new URLSearchParams();
  if (options.q) {
    params.set("q", options.q);
  }
  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (typeof options.offset === "number") {
    params.set("offset", String(options.offset));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

const buildSchemaTemplateListQuery = (options: {
  q?: string;
  limit?: number;
  offset?: number;
}) => {
  const params = new URLSearchParams();
  if (options.q) {
    params.set("q", options.q);
  }
  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (typeof options.offset === "number") {
    params.set("offset", String(options.offset));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(buildApiUrl("/auth/refresh"), {
        method: "POST",
        credentials: "include"
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setAccessToken(null);
        }
        return null;
      }

      const data = (await response.json()) as TokenResponse;
      if (!data?.access_token) {
        return null;
      }

      setAccessToken(data.access_token);
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export type ApiRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: HeadersInit;
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

export const apiRequest = async <T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> => {
  const {
    body,
    headers,
    skipAuth = false,
    skipRefresh = false,
    credentials,
    ...init
  } = options;

  const requestHeaders = new Headers(headers ?? {});
  let resolvedBody: BodyInit | undefined;

  if (body !== undefined) {
    if (isBodyInit(body)) {
      resolvedBody = body;
    } else {
      if (!requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", "application/json");
      }
      resolvedBody = JSON.stringify(body);
    }
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token && !requestHeaders.has("Authorization")) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: requestHeaders,
    body: resolvedBody,
    credentials: credentials ?? "include"
  });

  if (response.status === 401 && !skipAuth && !skipRefresh) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      requestHeaders.set("Authorization", `Bearer ${refreshedToken}`);
      const retryResponse = await fetch(buildApiUrl(path), {
        ...init,
        headers: requestHeaders,
        body: resolvedBody,
        credentials: credentials ?? "include"
      });
      return parseResponse<T>(retryResponse);
    }
  }

  return parseResponse<T>(response);
};

const adminRequest = async <T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> => {
  const token = getAdminToken();
  if (!token) {
    throw new ApiError(401, "Admin not authenticated");
  }
  const requestHeaders = new Headers(options.headers ?? {});
  requestHeaders.set("Authorization", `Bearer ${token}`);
  return apiRequest<T>(path, {
    ...options,
    headers: requestHeaders,
    skipAuth: true,
    skipRefresh: true
  });
};

export const authApi = {
  register: (payload: { email: string; password: string }) =>
    apiRequest<MessageResponse>("/auth/register", {
      method: "POST",
      body: payload,
      skipAuth: true,
      skipRefresh: true
    }),
  verifyEmail: (payload: { token: string }) =>
    apiRequest<MessageResponse>("/auth/verify", {
      method: "POST",
      body: payload,
      skipAuth: true,
      skipRefresh: true
    }),
  login: async (payload: { email: string; password: string }) => {
    const data = await apiRequest<TokenResponse>("/auth/login", {
      method: "POST",
      body: payload,
      skipAuth: true,
      skipRefresh: true
    });
    setAccessToken(data.access_token);
    return data;
  },
  refresh: async () => {
    const data = await apiRequest<TokenResponse>("/auth/refresh", {
      method: "POST",
      skipAuth: true,
      skipRefresh: true
    });
    setAccessToken(data.access_token);
    return data;
  },
  logout: async () => {
    await apiRequest<MessageResponse>("/auth/logout", {
      method: "POST",
      skipRefresh: true
    });
    setAccessToken(null);
  },
  forgotPassword: (payload: { email: string }) =>
    apiRequest<MessageResponse>("/auth/forgot", {
      method: "POST",
      body: payload,
      skipAuth: true,
      skipRefresh: true
    }),
  resetPassword: (payload: { token: string; password: string }) =>
    apiRequest<MessageResponse>("/auth/reset", {
      method: "POST",
      body: payload,
      skipAuth: true,
      skipRefresh: true
    }),
  me: () => apiRequest<UserResponse>("/auth/me"),
  deleteAccount: () =>
    apiRequest<MessageResponse>("/auth/me", {
      method: "DELETE"
    })
};

export const profileApi = {
  me: () => apiRequest<PublicProfileResponse>("/profiles/me"),
  updateMe: (payload: { username: string }) =>
    apiRequest<PublicProfileResponse>("/profiles/me", {
      method: "PATCH",
      body: payload
    }),
  getPublic: (username: string) =>
    apiRequest<PublicProfileResponse>(`/profiles/${encodeURIComponent(username)}`, {
      skipAuth: true,
      skipRefresh: true
    }),
  listPublicCollections: (username: string) =>
    apiRequest<CollectionResponse[]>(
      `/profiles/${encodeURIComponent(username)}/collections`,
      {
        skipAuth: true,
        skipRefresh: true
      }
    )
};

export const adminApi = {
  login: async (payload: { email: string; password: string }) => {
    const data = await apiRequest<AdminTokenResponse>("/admin/login", {
      method: "POST",
      body: payload,
      skipAuth: true,
      skipRefresh: true
    });
    setAdminToken(data.access_token);
    return data;
  },
  logout: () => {
    setAdminToken(null);
  },
  stats: () => adminRequest<AdminStatsResponse>("/admin/stats"),
  collections: (
    options: { offset?: number; limit?: number; publicOnly?: boolean } = {}
  ) => {
    const params = new URLSearchParams();
    if (typeof options.offset === "number") {
      params.set("offset", String(options.offset));
    }
    if (typeof options.limit === "number") {
      params.set("limit", String(options.limit));
    }
    if (options.publicOnly) {
      params.set("public_only", "true");
    }
    const query = params.toString();
    return adminRequest<AdminCollectionListResponse>(
      `/admin/collections${query ? `?${query}` : ""}`
    );
  },
  deleteCollection: (collectionId: number) =>
    adminRequest<MessageResponse>(`/admin/collections/${collectionId}`, {
      method: "DELETE"
    }),
  users: (
    options: { offset?: number; limit?: number; q?: string } = {}
  ) => {
    const params = new URLSearchParams();
    if (typeof options.offset === "number") {
      params.set("offset", String(options.offset));
    }
    if (typeof options.limit === "number") {
      params.set("limit", String(options.limit));
    }
    if (options.q) {
      params.set("q", options.q);
    }
    const query = params.toString();
    return adminRequest<AdminUserListResponse>(
      `/admin/users${query ? `?${query}` : ""}`
    );
  },
  setUserLocked: (userId: number, locked: boolean) =>
    adminRequest<AdminUserResponse>(`/admin/users/${userId}/lock`, {
      method: "PATCH",
      body: { locked }
    }),
  deleteUser: (userId: number) =>
    adminRequest<MessageResponse>(`/admin/users/${userId}`, {
      method: "DELETE"
    }),
  items: (
    options: {
      offset?: number;
      limit?: number;
      q?: string;
      collectionId?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    if (typeof options.offset === "number") {
      params.set("offset", String(options.offset));
    }
    if (typeof options.limit === "number") {
      params.set("limit", String(options.limit));
    }
    if (options.q) {
      params.set("q", options.q);
    }
    if (typeof options.collectionId === "number") {
      params.set("collection_id", String(options.collectionId));
    }
    const query = params.toString();
    return adminRequest<AdminItemListResponse>(
      `/admin/items${query ? `?${query}` : ""}`
    );
  },
  deleteItem: (itemId: number) =>
    adminRequest<MessageResponse>(`/admin/items/${itemId}`, {
      method: "DELETE"
    }),
  feature: (collectionId: number | null) =>
    adminRequest<MessageResponse>("/admin/featured", {
      method: "POST",
      body: { collection_id: collectionId }
    }),
  featuredItems: () =>
    adminRequest<AdminFeaturedItemResponse[]>("/admin/featured/items"),
  setFeaturedItems: (itemIds: number[]) =>
    adminRequest<MessageResponse>("/admin/featured/items", {
      method: "POST",
      body: { item_ids: itemIds }
    })
};

export const collectionApi = {
  list: () => apiRequest<CollectionResponse[]>("/collections"),
  create: (payload: CollectionCreatePayload) =>
    apiRequest<CollectionResponse>("/collections", {
      method: "POST",
      body: payload
    }),
  get: (collectionId: number | string) =>
    apiRequest<CollectionResponse>(`/collections/${collectionId}`),
  update: (collectionId: number | string, payload: CollectionUpdatePayload) =>
    apiRequest<CollectionResponse>(`/collections/${collectionId}`, {
      method: "PATCH",
      body: payload
    })
};

export const schemaTemplateApi = {
  list: (options: { q?: string; limit?: number; offset?: number } = {}) =>
    apiRequest<SchemaTemplateSummaryResponse[]>(
      `/schema-templates${buildSchemaTemplateListQuery(options)}`
    ),
  create: (payload: SchemaTemplateCreatePayload) =>
    apiRequest<SchemaTemplateResponse>("/schema-templates", {
      method: "POST",
      body: payload
    }),
  get: (templateId: number | string) =>
    apiRequest<SchemaTemplateResponse>(`/schema-templates/${templateId}`),
  update: (
    templateId: number | string,
    payload: SchemaTemplateUpdatePayload
  ) =>
    apiRequest<SchemaTemplateResponse>(`/schema-templates/${templateId}`, {
      method: "PATCH",
      body: payload
    }),
  delete: (templateId: number | string) =>
    apiRequest<MessageResponse>(`/schema-templates/${templateId}`, {
      method: "DELETE"
    }),
  copy: (
    templateId: number | string,
    payload: SchemaTemplateCopyPayload = {}
  ) =>
    apiRequest<SchemaTemplateResponse>(`/schema-templates/${templateId}/copy`, {
      method: "POST",
      body: payload
    }),
  listFields: (templateId: number | string) =>
    apiRequest<SchemaTemplateFieldResponse[]>(
      `/schema-templates/${templateId}/fields`
    ),
  createField: (
    templateId: number | string,
    payload: FieldDefinitionCreatePayload
  ) =>
    apiRequest<SchemaTemplateFieldResponse>(
      `/schema-templates/${templateId}/fields`,
      {
        method: "POST",
        body: payload
      }
    ),
  updateField: (
    templateId: number | string,
    fieldId: number | string,
    payload: FieldDefinitionUpdatePayload
  ) =>
    apiRequest<SchemaTemplateFieldResponse>(
      `/schema-templates/${templateId}/fields/${fieldId}`,
      {
        method: "PATCH",
        body: payload
      }
    ),
  deleteField: (templateId: number | string, fieldId: number | string) =>
    apiRequest<MessageResponse>(
      `/schema-templates/${templateId}/fields/${fieldId}`,
      {
        method: "DELETE"
      }
    ),
  reorderFields: (templateId: number | string, fieldIds: number[]) =>
    apiRequest<SchemaTemplateFieldResponse[]>(
      `/schema-templates/${templateId}/fields/reorder`,
      {
        method: "PATCH",
        body: { field_ids: fieldIds }
      }
    )
};

export const activityApi = {
  list: (options: { limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (typeof options.limit === "number") {
      params.set("limit", String(options.limit));
    }
    const query = params.toString();
    return apiRequest<ActivityLogResponse[]>(`/activity${query ? `?${query}` : ""}`);
  }
};

export const starsApi = {
  listCollections: (options: { q?: string; limit?: number; offset?: number } = {}) =>
    apiRequest<StarredCollectionResponse[]>(
      `/stars/collections${buildStarsListQuery(options)}`
    ),
  listItems: (options: { q?: string; limit?: number; offset?: number } = {}) =>
    apiRequest<StarredItemResponse[]>(`/stars/items${buildStarsListQuery(options)}`),
  collectionStatus: (collectionId: number | string) =>
    apiRequest<StarStatusResponse>(`/stars/collections/${collectionId}`),
  starCollection: (collectionId: number | string) =>
    apiRequest<StarStatusResponse>(`/stars/collections/${collectionId}`, {
      method: "POST"
    }),
  unstarCollection: (collectionId: number | string) =>
    apiRequest<StarStatusResponse>(`/stars/collections/${collectionId}`, {
      method: "DELETE"
    }),
  itemStatus: (collectionId: number | string, itemId: number | string) =>
    apiRequest<StarStatusResponse>(
      `/stars/collections/${collectionId}/items/${itemId}`
    ),
  starItem: (collectionId: number | string, itemId: number | string) =>
    apiRequest<StarStatusResponse>(
      `/stars/collections/${collectionId}/items/${itemId}`,
      {
        method: "POST"
      }
    ),
  unstarItem: (collectionId: number | string, itemId: number | string) =>
    apiRequest<StarStatusResponse>(
      `/stars/collections/${collectionId}/items/${itemId}`,
      {
        method: "DELETE"
      }
    )
};

export const publicCollectionApi = {
  list: () =>
    apiRequest<CollectionResponse[]>("/public/collections", {
      skipAuth: true,
      skipRefresh: true
    }),
  featured: () =>
    apiRequest<CollectionResponse | null>("/public/collections/featured", {
      skipAuth: true,
      skipRefresh: true
    }),
  featuredItems: () =>
    apiRequest<FeaturedItemResponse[]>("/public/collections/featured/items", {
      skipAuth: true,
      skipRefresh: true
    }),
  get: (collectionId: number | string) =>
    apiRequest<CollectionResponse>(`/public/collections/${collectionId}`, {
      skipAuth: true,
      skipRefresh: true
    })
};

export const searchApi = {
  items: (
    query: string,
    options: { offset?: number; limit?: number } = {}
  ) => {
    const params = new URLSearchParams({ q: query });
    if (typeof options.offset === "number") {
      params.set("offset", String(options.offset));
    }
    if (typeof options.limit === "number") {
      params.set("limit", String(options.limit));
    }
    return apiRequest<ItemSearchResponse[]>(`/search/items?${params.toString()}`);
  }
};

export const publicItemApi = {
  list: (collectionId: number | string, options?: ItemListOptions) =>
    apiRequest<ItemResponse[]>(
      `/public/collections/${collectionId}/items${buildItemListQuery(options)}`,
      {
        skipAuth: true,
        skipRefresh: true
      }
    ),
  get: (collectionId: number | string, itemId: number | string) =>
    apiRequest<ItemResponse>(
      `/public/collections/${collectionId}/items/${itemId}`,
      {
        skipAuth: true,
        skipRefresh: true
      }
    )
};

export const itemApi = {
  list: (collectionId: number | string, options?: ItemListOptions) =>
    apiRequest<ItemResponse[]>(
      `/collections/${collectionId}/items${buildItemListQuery(options)}`
    ),
  create: (collectionId: number | string, payload: ItemCreatePayload) =>
    apiRequest<ItemResponse>(`/collections/${collectionId}/items`, {
      method: "POST",
      body: payload
    }),
  get: (collectionId: number | string, itemId: number | string) =>
    apiRequest<ItemResponse>(`/collections/${collectionId}/items/${itemId}`),
  update: (
    collectionId: number | string,
    itemId: number | string,
    payload: ItemUpdatePayload
  ) =>
    apiRequest<ItemResponse>(`/collections/${collectionId}/items/${itemId}`, {
      method: "PATCH",
      body: payload
    }),
  delete: (collectionId: number | string, itemId: number | string) =>
    apiRequest<MessageResponse>(`/collections/${collectionId}/items/${itemId}`, {
      method: "DELETE"
    })
};

export const fieldApi = {
  list: (collectionId: number | string) =>
    apiRequest<FieldDefinitionResponse[]>(
      `/collections/${collectionId}/fields`
    ),
  create: (
    collectionId: number | string,
    payload: FieldDefinitionCreatePayload
  ) =>
    apiRequest<FieldDefinitionResponse>(
      `/collections/${collectionId}/fields`,
      {
        method: "POST",
        body: payload
      }
    ),
  update: (
    collectionId: number | string,
    fieldId: number | string,
    payload: FieldDefinitionUpdatePayload
  ) =>
    apiRequest<FieldDefinitionResponse>(
      `/collections/${collectionId}/fields/${fieldId}`,
      {
        method: "PATCH",
        body: payload
      }
    ),
  delete: (collectionId: number | string, fieldId: number | string) =>
    apiRequest<MessageResponse>(
      `/collections/${collectionId}/fields/${fieldId}`,
      {
        method: "DELETE"
      }
    ),
  reorder: (collectionId: number | string, fieldIds: number[]) =>
    apiRequest<FieldDefinitionResponse[]>(
      `/collections/${collectionId}/fields/reorder`,
      {
        method: "PATCH",
        body: { field_ids: fieldIds }
      }
    )
};

export const imageApi = {
  upload: (itemId: number | string, file: File) => {
    const payload = new FormData();
    payload.append("file", file);
    return apiRequest<ItemImageResponse>(`/items/${itemId}/images`, {
      method: "POST",
      body: payload
    });
  },
  list: (itemId: number | string) =>
    apiRequest<ItemImageResponse[]>(`/items/${itemId}/images`),
  update: (
    itemId: number | string,
    imageId: number | string,
    payload: ItemImageUpdatePayload
  ) =>
    apiRequest<ItemImageResponse>(`/items/${itemId}/images/${imageId}`, {
      method: "PATCH",
      body: payload
    }),
  delete: (itemId: number | string, imageId: number | string) =>
    apiRequest<MessageResponse>(`/items/${itemId}/images/${imageId}`, {
      method: "DELETE"
    }),
  url: (imageId: number | string, variant: "original" | "medium" | "thumb") =>
    buildApiUrl(`/images/${imageId}/${variant}.jpg`)
};

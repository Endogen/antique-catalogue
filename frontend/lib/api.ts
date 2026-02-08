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
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type CollectionResponse = {
  id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type CollectionCreatePayload = {
  name: string;
  description?: string | null;
  is_public?: boolean;
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
  options: FieldOptions | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type FieldDefinitionCreatePayload = {
  name: string;
  field_type: string;
  is_required?: boolean;
  options?: FieldOptions | null;
};

export type FieldDefinitionUpdatePayload = {
  name?: string;
  field_type?: string;
  is_required?: boolean;
  options?: FieldOptions | null;
};

export type ItemResponse = {
  id: number;
  collection_id: number;
  name: string;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicItemListOptions = {
  search?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  filters?: string[];
};

export type ApiErrorPayload = {
  detail?: string;
  message?: string;
  errors?: unknown;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000";

const ACCESS_TOKEN_STORAGE_KEY = "antique_access_token";

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

  return (await response.text()) as T;
};

const buildPublicItemsQuery = (options?: PublicItemListOptions) => {
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

export const publicCollectionApi = {
  list: () =>
    apiRequest<CollectionResponse[]>("/public/collections", {
      skipAuth: true,
      skipRefresh: true
    }),
  get: (collectionId: number | string) =>
    apiRequest<CollectionResponse>(`/public/collections/${collectionId}`, {
      skipAuth: true,
      skipRefresh: true
    })
};

export const publicItemApi = {
  list: (collectionId: number | string, options?: PublicItemListOptions) =>
    apiRequest<ItemResponse[]>(
      `/public/collections/${collectionId}/items${buildPublicItemsQuery(
        options
      )}`,
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

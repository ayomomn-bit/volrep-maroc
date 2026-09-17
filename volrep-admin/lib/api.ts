// The one place the admin app talks to the backend.
//
// SECURITY: every request is browser -> backend with `credentials:
// "include"` so the httpOnly `volrep_admin_session` cookie rides along.
// There is NO `x-internal-api-key` here (that is a server-to-server
// storefront credential and the backend rejects it on /api/admin/*), no
// bearer token in JS, no secret in any NEXT_PUBLIC_ var. The only config
// is the backend base URL, which is not sensitive.

import { t } from "@/lib/i18n";

export const API_BASE = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Set by AuthProvider so a 401 anywhere can bounce the user to /login
// without every call site handling it.
let onUnauthenticated: (() => void) | null = null;
export function setUnauthenticatedHandler(fn: (() => void) | null): void {
  onUnauthenticated = fn;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  // Opt out of the global 401 -> /login bounce (used by the login page's
  // own "am I already signed in?" check).
  suppressAuthRedirect?: boolean;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, API_BASE);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      credentials: "include",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : {},
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK", t.common.networkError);
  }

  if (response.status === 401) {
    if (!options.suppressAuthRedirect && onUnauthenticated) onUnauthenticated();
    throw new ApiError(401, "UNAUTHENTICATED", t.common.sessionExpired);
  }

  const raw = await response.text();
  const data: unknown = raw ? safeJson(raw) : undefined;

  if (!response.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
    throw new ApiError(
      response.status,
      err?.code ?? "ERROR",
      err?.message ?? t.common.requestFailed(response.status),
      err?.details,
    );
  }

  return data as T;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// Multipart upload — the browser sets the multipart boundary itself, so we
// must NOT set Content-Type. Same credentials + error handling as request().
async function upload<T>(path: string, form: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: "POST",
      credentials: "include",
      body: form,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK", t.common.networkError);
  }

  if (response.status === 401) {
    if (onUnauthenticated) onUnauthenticated();
    throw new ApiError(401, "UNAUTHENTICATED", t.common.sessionExpired);
  }

  const raw = await response.text();
  const data: unknown = raw ? safeJson(raw) : undefined;
  if (!response.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
    throw new ApiError(response.status, err?.code ?? "ERROR", err?.message ?? t.common.requestFailed(response.status), err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"], opts?: Pick<RequestOptions, "suppressAuthRedirect">) =>
    request<T>(path, { method: "GET", query, ...opts }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload,
};

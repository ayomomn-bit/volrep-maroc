import "server-only";

// Server-only Volrep backend client. The `server-only` import above makes
// this module a hard build error if it's ever imported from a "use
// client" component — the same protection Next.js's own docs recommend
// for exactly this case, on top of these env vars never being
// NEXT_PUBLIC_ (see AGENTS.md / the approved backend architecture, §14).
//
// Every call in this codebase to the Volrep backend goes through here,
// server-to-server — the browser never sees VOLREP_INTERNAL_API_KEY, and
// never calls the backend directly. See lib/backend/cart-actions.ts and
// lib/backend/checkout-actions.ts for the Server Actions that are this
// module's only path from the browser.

const rawBackendUrl = process.env.VOLREP_BACKEND_URL;
const rawInternalApiKey = process.env.VOLREP_INTERNAL_API_KEY;

if (!rawBackendUrl) {
  throw new Error("Missing VOLREP_BACKEND_URL");
}

if (!rawInternalApiKey) {
  throw new Error("Missing VOLREP_INTERNAL_API_KEY");
}

// Re-bound to a new const right after the guard above: TypeScript narrows
// `rawBackendUrl`/`rawInternalApiKey` to `string` at this line, but that
// narrowing wouldn't otherwise survive into backendFetch()'s closure below
// (a function defined later that captures a module-level `const` is
// checked against its original declared type, not the narrowed one).
const BACKEND_URL: string = rawBackendUrl;
const INTERNAL_API_KEY: string = rawInternalApiKey;

// Typed shape of every error the backend returns (see
// volrep-backend/src/plugins/error-handler.ts) — never a raw stack trace,
// always { code, message }.
export class BackendError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "BackendError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type BackendRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  // Forwarded to fetch's Next.js extensions for cache/revalidate control,
  // same as any other server-side fetch in this app.
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  // Real client IP of the browser request this call is made on behalf of.
  // Set only on the COD order path (see lib/backend/request-ip.ts): the
  // backend's per-IP abuse guard must key on the actual shopper, not on
  // this server's single outbound address. Sent as X-Forwarded-For and
  // trusted by the backend only because this is an authenticated
  // server-to-server call (x-internal-api-key) from a loopback peer.
  forwardedFor?: string | null;
};

function buildUrl(path: string, query?: BackendRequestOptions["query"]): string {
  const url = new URL(path, BACKEND_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

// Centralized request/error handling — every lib/backend/*.ts data-layer
// function calls this rather than using fetch() directly, so there is one
// place that attaches the internal API key and one place that turns a
// non-2xx response into a typed, catchable error.
export async function backendFetch<T>(path: string, options: BackendRequestOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: {
      "x-internal-api-key": INTERNAL_API_KEY,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.forwardedFor ? { "x-forwarded-for": options.forwardedFor } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: options.cache,
    next: options.next,
  });

  const raw = await response.text();
  const data: unknown = raw ? JSON.parse(raw) : undefined;

  if (!response.ok) {
    const errorBody = (data as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
    throw new BackendError(
      response.status,
      errorBody?.code ?? "UNKNOWN",
      errorBody?.message ?? "The request failed.",
      errorBody?.details,
    );
  }

  return data as T;
}

import { env } from "../../config/env.js";
import { LiryaError, codeForStatus, type LiryaProblem } from "./errors.js";
import type {
  LiryaClient,
  LiryaClientOptions,
  LiryaGetResult,
  LiryaListParams,
  LiryaListResult,
  LiryaLogger,
  LiryaPage,
} from "./types.js";

// Server-side client for the Lirya landing-page API (V1, READ-ONLY).
//
// SECURITY / TRANSPORT contract:
//  - `Authorization: Bearer <key>` only. The key is NEVER put in a URL,
//    query string, or log line.
//  - TLS is enforced in production: a non-https base URL throws at
//    construction.
//  - ~5s timeout per attempt (AbortController).
//  - 1-2 retries with exponential backoff + jitter for transient failures
//    (network, timeout, 429, 5xx). `Retry-After` is honoured on 429.
//  - application/problem+json bodies are parsed; `X-Request-Id` is captured
//    into every log entry and every thrown LiryaError.
//  - Only the `pages:read` scope is used: two GETs, nothing else.

const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 10_000;

const noopLogger: LiryaLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Backoff for attempt N (0-based): ~250ms, ~500ms, ~1s … plus up to 50% jitter.
function backoffDelay(attempt: number): number {
  const base = Math.min(250 * 2 ** attempt, MAX_RETRY_DELAY_MS);
  return base + Math.random() * base * 0.5;
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

async function readProblem(response: Response): Promise<LiryaProblem | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("problem+json") && !contentType.includes("application/json")) {
    return null;
  }
  try {
    const body = (await response.json()) as LiryaProblem;
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

// Pull the page array + forward cursor out of the list response.
//
// Real Lirya V1 contract (verified against the audited API):
//   { "data": [ ...pages ], "pagination": { "limit", "has_more", "next_cursor" } }
//
// A minimal fallback is kept for older/mocked shapes (`pages`, a bare
// array), but `data` + `pagination` is the authoritative form.
function parseListBody(body: unknown): LiryaListResult {
  const b = (body ?? {}) as Record<string, unknown>;

  const rawPages =
    (Array.isArray(b.data) && b.data) ||
    (Array.isArray(b.pages) && b.pages) || // minimal fallback
    (Array.isArray(body) ? (body as unknown[]) : []);
  const pages = (rawPages as unknown[]).filter((p): p is LiryaPage => !!p && typeof p === "object");

  const pagination =
    b.pagination && typeof b.pagination === "object" ? (b.pagination as Record<string, unknown>) : null;
  const cursorFrom = (o: Record<string, unknown> | null): string | null =>
    o && typeof o.next_cursor === "string" && o.next_cursor ? o.next_cursor : null;
  const rawCursor = cursorFrom(pagination) ?? cursorFrom(b);

  // With the real envelope, `has_more` is the source of truth: a cursor is
  // only meaningful when Lirya says there are more results. Without a
  // `pagination` object (fallback shapes) fall back to cursor presence.
  const nextCursor = pagination ? (pagination.has_more === true ? rawCursor : null) : rawCursor;

  return { pages, nextCursor };
}

export function createLiryaClient(options: LiryaClientOptions): LiryaClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const apiKey = options.apiKey;
  const adminBaseUrl = options.adminBaseUrl?.replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? env.LIRYA_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const doFetch = options.fetchImpl ?? fetch;
  const log = options.logger ?? noopLogger;

  if (env.NODE_ENV === "production" && !baseUrl.startsWith("https://")) {
    throw new Error("LIRYA_API_BASE_URL must use https in production");
  }

  // One HTTP attempt with a hard timeout. Returns the Response (any status)
  // or throws a LiryaError for network / timeout.
  async function attempt(path: string, headers: Record<string, string>): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await doFetch(`${baseUrl}${path}`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      throw new LiryaError(
        aborted ? "timeout" : "network",
        aborted ? `Lirya request timed out after ${timeoutMs}ms` : "Lirya request failed to connect",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  // Runs `attempt` with retries. `path` must already include the query
  // string. The API key rides only in the Authorization header.
  async function requestWithRetry(path: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...extraHeaders,
    };

    let lastError: LiryaError | null = null;

    for (let i = 0; i <= maxRetries; i++) {
      let response: Response;
      try {
        response = await attempt(path, headers);
      } catch (err) {
        lastError = err as LiryaError;
        // path is logged WITHOUT the Authorization header — never the key.
        log.warn({ path, attempt: i, code: lastError.code }, "Lirya request error, retrying");
        if (i < maxRetries) {
          await sleep(backoffDelay(i));
          continue;
        }
        throw lastError;
      }

      const requestId = response.headers.get("x-request-id");

      if (response.status === 429) {
        const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
        log.warn({ path, requestId, retryAfterMs }, "Lirya rate limited");
        if (i < maxRetries) {
          await sleep(Math.min(retryAfterMs ?? backoffDelay(i), MAX_RETRY_DELAY_MS));
          continue;
        }
        const problem = await readProblem(response);
        throw new LiryaError("rate_limited", "Lirya rate limit exceeded", {
          status: 429,
          requestId,
          retryAfterMs,
          problem,
        });
      }

      if (response.status >= 500) {
        log.warn({ path, requestId, status: response.status }, "Lirya server error");
        if (i < maxRetries) {
          await sleep(backoffDelay(i));
          continue;
        }
        const problem = await readProblem(response);
        throw new LiryaError("bad_gateway", `Lirya responded ${response.status}`, {
          status: response.status,
          requestId,
          problem,
        });
      }

      return response;
    }

    // Unreachable — the loop either returns or throws.
    throw lastError ?? new LiryaError("unexpected", "Lirya request failed");
  }

  async function throwForResponse(response: Response): Promise<never> {
    const requestId = response.headers.get("x-request-id");
    const problem = await readProblem(response);
    const code = codeForStatus(response.status);
    log.error({ requestId, status: response.status, code }, "Lirya request rejected");
    throw new LiryaError(code, problem?.detail ?? problem?.title ?? `Lirya responded ${response.status}`, {
      status: response.status,
      requestId,
      problem,
    });
  }

  return {
    async listPages(params: LiryaListParams = {}): Promise<LiryaListResult> {
      const qs = new URLSearchParams();
      if (params.type) qs.set("type", params.type);
      if (params.status) qs.set("status", params.status);
      if (params.slug) qs.set("slug", params.slug);
      if (params.productId) qs.set("product_id", params.productId);
      if (params.purpose) qs.set("purpose", params.purpose);
      if (params.updatedSince) qs.set("updated_since", params.updatedSince);
      if (params.cursor) qs.set("cursor", params.cursor);
      if (params.limit) qs.set("limit", String(params.limit));
      const query = qs.toString();
      const path = `/api/v1/pages${query ? `?${query}` : ""}`;

      const response = await requestWithRetry(path);
      if (!response.ok) await throwForResponse(response);

      const requestId = response.headers.get("x-request-id");
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new LiryaError("unexpected", "Lirya list response was not JSON", { requestId });
      }
      const result = parseListBody(body);
      log.info({ requestId, count: result.pages.length }, "Lirya pages listed");
      return result;
    },

    async getPage(id: string, opts: { etag?: string | null | undefined } = {}): Promise<LiryaGetResult> {
      const extraHeaders: Record<string, string> = {};
      if (opts.etag) extraHeaders["If-None-Match"] = opts.etag;

      const response = await requestWithRetry(`/api/v1/pages/${encodeURIComponent(id)}`, extraHeaders);
      const requestId = response.headers.get("x-request-id");

      if (response.status === 304) {
        log.info({ requestId, id }, "Lirya page not modified");
        return { status: 304 };
      }

      if (!response.ok) await throwForResponse(response);

      let page: LiryaPage;
      try {
        page = (await response.json()) as LiryaPage;
      } catch {
        throw new LiryaError("unexpected", "Lirya page response was not JSON", { requestId });
      }
      log.info({ requestId, id, status: page.status }, "Lirya page fetched");
      return { status: 200, page };
    },

    editorUrl(slug: string): string | null {
      if (!adminBaseUrl || !slug) return null;
      return `${adminBaseUrl}/editor.html?slug=${encodeURIComponent(slug)}`;
    },
  };
}

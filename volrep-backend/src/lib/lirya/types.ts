// The Lirya landing-page projection returned by GET /api/v1/pages and
// GET /api/v1/pages/{id}. This is the ONLY shape Volrep reads from Lirya —
// no HTML, no structured content, no lp_config, no rendered markup. The
// stable identity is `id` (a `pg_*` string).
export type LiryaPageStatus = "published" | "hidden" | "draft";

// `external_ref` is Lirya's back-reference to whatever owns the page. In
// Volrep's model it should carry `{ product_id }`; parsed defensively
// because Lirya may return null or a different shape.
export type LiryaExternalRef = { product_id?: string | null } & Record<string, unknown>;

export type LiryaPage = {
  id: string;
  type: string;
  slug: string;
  name: string;
  status: LiryaPageStatus | string;
  template: string | null;
  url: string | null;
  external_ref: LiryaExternalRef | null;
  // Real contract returns a number (e.g. 1); tolerated as string for
  // older/mocked shapes. Normalised to a string before it is cached.
  version: string | number | null;
  etag: string | null;
  content_source: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

export type LiryaListParams = {
  type?: string;
  status?: string;
  slug?: string;
  // Sent to Lirya as `product_id`.
  productId?: string;
  purpose?: string;
  // Sent to Lirya as `updated_since` (ISO-8601 timestamp).
  updatedSince?: string;
  cursor?: string | null;
  limit?: number;
};

export type LiryaListResult = {
  pages: LiryaPage[];
  nextCursor: string | null;
};

export type LiryaGetResult =
  | { status: 200; page: LiryaPage }
  | { status: 304 };

// Minimal structured logger the client writes to. A pino instance
// satisfies this; tests pass a spy. The client NEVER passes the API key
// to any of these.
export type LiryaLogger = {
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
};

export type LiryaClientOptions = {
  baseUrl: string;
  apiKey: string;
  adminBaseUrl?: string | undefined;
  timeoutMs?: number | undefined;
  // Injectable for tests. Defaults to the global fetch.
  fetchImpl?: typeof fetch | undefined;
  logger?: LiryaLogger | undefined;
  // Retry budget for transient failures (network / timeout / 429 / 5xx).
  maxRetries?: number | undefined;
};

export type LiryaClient = {
  listPages: (params?: LiryaListParams) => Promise<LiryaListResult>;
  getPage: (id: string, opts?: { etag?: string | null | undefined }) => Promise<LiryaGetResult>;
  // Builds the outbound legacy-editor link, or null when LIRYA_ADMIN_BASE_URL
  // is not set. Pure string construction — no request, no API key.
  editorUrl: (slug: string) => string | null;
};

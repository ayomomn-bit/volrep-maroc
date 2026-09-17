import { z } from "zod";

// Fail-fast environment validation — the same discipline the frontend's
// lib/shopify/client.ts already applies (throws at import time if a
// required credential is missing). Nothing downstream should have to
// guard against a malformed env var; if we got past this module, every
// value is well-typed.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // Bind loopback only by default: the production topology is
  //   Internet → Nginx/Caddy → Next.js → this backend (all co-located)
  // so the backend never needs to be reachable off-host. Set HOST=0.0.0.0
  // explicitly only for a split-host deployment, and firewall PORT then
  // (security hardening — Step 4 M4). A non-loopback bind in production
  // logs a warning at boot (loadEnv).
  HOST: z.string().min(1).default("127.0.0.1"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres connection string",
    ),

  // Shared secret for server-to-server calls from the Next.js frontend —
  // the storefront API never accepts browser traffic directly (Architecture
  // §01/§14), so this is the only credential that guards it. Base floor is
  // 16 for dev ergonomics; production additionally requires >= 32 chars and
  // rejects placeholder values (see the production superRefine below).
  INTERNAL_API_KEY: z.string().min(16, "INTERNAL_API_KEY must be at least 16 characters"),

  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  // Locked-down CORS origin for the admin panel (Architecture §14) — no
  // wildcard, no reflecting arbitrary origins. Kept for back-compat; the
  // authoritative allow-list is adminAllowedOrigins() below, which prefers
  // ADMIN_TRUSTED_ORIGINS when set.
  CORS_ADMIN_ORIGIN: z.string().url().default("http://localhost:3001"),
  // The admin origin allow-list, used for BOTH CORS and the CSRF
  // Origin/Referer check on state-changing /api/admin/* requests
  // (security hardening — Step 2). Comma-separated absolute origins, no
  // wildcards, no paths — e.g.
  //   ADMIN_TRUSTED_ORIGINS=https://admin.volrep.com,https://admin.staging.volrep.com
  // When unset it falls back to [CORS_ADMIN_ORIGIN] so existing setups keep
  // working unchanged.
  ADMIN_TRUSTED_ORIGINS: z.string().min(1).optional(),

  // HSTS max-age (seconds) sent ONLY when NODE_ENV=production. Default 2y.
  // Set to 0 to disable (e.g. a staging box not yet on permanent HTTPS).
  // `preload` is intentionally NOT sent — see .env.example / the Step 2
  // report for the domain-wide precondition.
  HSTS_MAX_AGE: z.coerce.number().int().nonnegative().default(63072000),

  CART_EXPIRY_DAYS: z.coerce.number().int().positive().default(30),

  // ---- Cart mutation rate limit (security hardening — Step 4 L3) -------
  // Per-route @fastify/rate-limit on POST/PATCH/DELETE /api/cart/lines (the
  // GET is read-only and excluded). Keyed per cart id when the request
  // carries one, else per client IP. `allowList: []` keeps it effective for
  // the storefront's internal-key traffic (mirrors COD / order-tracking).
  // Generous by design: the storefront disables the quantity stepper while
  // a mutation is in flight, so a human never approaches this — a script
  // hammering add/update/remove does.
  CART_MUTATION_RATE_MAX: z.coerce.number().int().positive().default(60),
  CART_MUTATION_RATE_TIME_WINDOW: z.string().min(1).default("1 minute"),

  // ---- Product Studio "Page produit" draft preview -----------------
  // HMAC secret for the short-lived tokens that let an authenticated admin
  // open the storefront on the UNPUBLISHED draft of a product page. Optional
  // in dev — when unset it falls back to INTERNAL_API_KEY so preview works
  // out of the box. PRODUCTION requires a DISTINCT value (>= 32 chars, no
  // placeholder) — enforced in the superRefine below (security hardening —
  // Step 4 M3). Rotate it independently of INTERNAL_API_KEY.
  PRODUCT_PAGE_PREVIEW_SECRET: z.string().min(16).optional(),

  // Base URL of the storefront (volrep-maroc). When set, publishing a
  // product page pings {STOREFRONT_BASE_URL}/api/revalidate (auth:
  // x-internal-api-key = INTERNAL_API_KEY) so the change goes live at once
  // instead of waiting out the storefront's ISR window. Optional — unset in
  // dev just means the change appears on the next revalidation.
  STOREFRONT_BASE_URL: z.string().url().optional(),

  // ---- Product media storage (Phase 7C-2) --------------------------
  // The storage layer sits behind an adapter (src/lib/media-storage) so a
  // VPS deployment can switch MEDIA_STORAGE_DRIVER to "s3" later without
  // touching the product editor or the media service.
  MEDIA_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  // local driver: directory the uploaded files live in (dev: ./var/media).
  MEDIA_LOCAL_DIR: z.string().min(1).default("./var/media"),
  // Public origin that serves the media. local driver: this backend
  // (Fastify serves /media/* from MEDIA_LOCAL_DIR). s3 driver: the bucket /
  // CDN origin. No trailing slash.
  MEDIA_PUBLIC_BASE_URL: z.string().url().default("http://localhost:4000"),
  // Max upload size in bytes (default 10 MiB). Applies to images.
  MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  // Max upload size for MP4 video (default 64 MiB). Only the "Page produit"
  // section-media upload accepts video; the product gallery stays images-only.
  MEDIA_VIDEO_MAX_BYTES: z.coerce.number().int().positive().default(64 * 1024 * 1024),
  // Max upload size for an animated GIF (default 16 MiB). Section-media only,
  // same as video — the gallery never accepts a GIF.
  MEDIA_GIF_MAX_BYTES: z.coerce.number().int().positive().default(16 * 1024 * 1024),

  // ---- Media decompression-bomb guard (security hardening — Step 3) --
  // Raster images (JPEG/PNG/WebP/GIF) are rejected before storage when
  // their DECLARED dimensions exceed either bound. Only the file header is
  // read (a few hundred bytes) — pixels are never decoded. Defaults leave
  // generous headroom over any real product photo (~24 MP / 6000 px) while
  // stopping a small file that decodes to gigapixels.
  MEDIA_IMAGE_MAX_PIXELS: z.coerce.number().int().positive().default(40_000_000),
  MEDIA_IMAGE_MAX_DIMENSION: z.coerce.number().int().positive().default(12_000),

  // ---- Media upload rate limit (security hardening — Step 3) ---------
  // Per-IP cap on the two authenticated admin upload endpoints, on top of
  // the global 100/min. Generous: a full Studio session (gallery is capped
  // at 20 images/product) stays well under it; a script hammering uploads
  // does not.
  MEDIA_UPLOAD_RATE_MAX: z.coerce.number().int().positive().default(40),
  MEDIA_UPLOAD_RATE_TIME_WINDOW: z.string().min(1).default("5 minutes"),
  // s3 driver only — unused by (and not required for) the local driver.
  MEDIA_S3_BUCKET: z.string().optional(),
  MEDIA_S3_REGION: z.string().optional(),
  MEDIA_S3_ENDPOINT: z.string().optional(),
  MEDIA_S3_ACCESS_KEY_ID: z.string().optional(),
  MEDIA_S3_SECRET_ACCESS_KEY: z.string().optional(),

  // ---- Lirya landing-page integration (V1, READ-ONLY) --------------
  // Volrep binds a product to a Lirya landing page and caches a few
  // display fields; it never stores Lirya HTML/content and never writes
  // to Lirya (only the `pages:read` scope). All optional — when
  // LIRYA_API_BASE_URL is absent the integration reports "not configured"
  // and the admin Landing Pages tab shows a configuration hint instead of
  // erroring. The API key is server-only: it never reaches the browser and
  // is never logged.
  LIRYA_API_BASE_URL: z.string().url().optional(),
  // Base floor 16 for dev; production requires >= 32 chars + no placeholder
  // when the integration is configured (security hardening — Step 4 M3).
  LIRYA_API_KEY: z.string().min(16, "LIRYA_API_KEY must be at least 16 characters").optional(),
  // Base URL of the legacy Lirya editor — used only to build an outbound
  // "Modifier dans Lirya" navigation link. Never receives the API key.
  LIRYA_ADMIN_BASE_URL: z.string().url().optional(),
  // Per-request timeout for calls to the Lirya API.
  LIRYA_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  // ---- Reverse proxy / client IP (security hardening — Step 1A) --------
  // How Fastify decides whether to believe an `X-Forwarded-*` header and
  // derive `request.ip` / `request.ips` from it. The production topology is
  //   Internet → Nginx/Caddy (same host) → this backend → PostgreSQL
  // so the default trusts only the loopback range: an internet client that
  // reaches the backend directly can never pick the IP used for rate
  // limiting by sending its own `X-Forwarded-For`. Accepts anything
  // Fastify's `trustProxy` does — a single IP/CIDR, a comma-separated list,
  // or the named ranges `loopback` / `linklocal` / `uniquelocal`. Use
  // `false` when the backend has no proxy in front of it. `true` (trust
  // every peer) is refused in production by the check below.
  TRUST_PROXY: z.string().min(1).default("loopback"),

  // ---- Public COD order abuse guard (security hardening — Step 1C) -----
  // Anti-flood limits for POST /api/checkout/session (the only public
  // order-creation endpoint). Tuned for Moroccan Cash-on-Delivery: a real
  // shopper places one or two orders, so these ceilings never touch
  // legitimate traffic but stop an automated flood. All server-side price /
  // stock / availability validation is unchanged and still authoritative.
  //   • per client IP — needs the real shopper IP; see TRUST_PROXY above and
  //     the storefront forwarding X-Forwarded-For on COD calls.
  COD_ORDER_IP_MAX: z.coerce.number().int().positive().default(20),
  COD_ORDER_IP_TIME_WINDOW: z.string().min(1).default("10 minutes"),
  //   • per canonical phone number — process-local sliding window. Short by
  //     design: it throttles order-spam, it does NOT permanently block a
  //     repeat customer (the window clears itself).
  COD_ORDER_PHONE_MAX: z.coerce.number().int().positive().default(5),
  COD_ORDER_PHONE_WINDOW_MINUTES: z.coerce.number().int().positive().default(30),

  // ---- Per-account admin-login throttle (security hardening — Step 4 M2) --
  // Caps failed password guesses against ONE admin account across ALL source
  // IPs, on top of the per-IP @fastify/rate-limit route limiter (10 / 15min,
  // unchanged). Self-healing window: a temporary throttle, never a permanent
  // lockout — the block lifts as the oldest failure ages out.
  ADMIN_ACCOUNT_LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(10),
  ADMIN_ACCOUNT_LOGIN_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
});

// ---- Production safety floor for secrets (security hardening — Step 4 M3) ----
const MIN_PROD_SECRET_LENGTH = 32;

// Obvious "you forgot to set this" values. Case-insensitive substring match —
// no entropy estimation, just a clear production floor.
const PLACEHOLDER_SUBSTRINGS = [
  "replace-with",
  "replace_with",
  "changeme",
  "change-me",
  "change_me",
  "not-a-real-secret",
  "not_a_real_secret",
  "your-secret",
  "your_secret",
  "example",
  "placeholder",
];

function looksLikePlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_SUBSTRINGS.some((needle) => lower.includes(needle));
}

// ---- Production DATABASE_URL TLS check (security hardening — Step 4 M4) ------
// A loopback / unix-socket database needs no TLS (the traffic never leaves the
// host). A remote host in production MUST carry an explicit TLS directive.
function databaseHostIsLocal(rawUrl: string): boolean {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return true; // unparseable — the field's own .refine() already flags it
  }
  if (host === "") return true; // no TCP host → unix socket / ?host= form
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost")
  );
}

function databaseUrlHasTls(rawUrl: string): boolean {
  let params: URLSearchParams;
  try {
    params = new URL(rawUrl).searchParams;
  } catch {
    return false;
  }
  // postgres.js maps `sslmode` → its `ssl` option straight from the URL,
  // and also honours `ssl=` directly (src/db/client.ts passes the URL
  // through unchanged). Only the modes that actually REQUIRE TLS count —
  // `prefer` / `allow` silently fall back to plaintext.
  const sslmode = (params.get("sslmode") ?? "").toLowerCase();
  if (sslmode === "require" || sslmode === "verify-ca" || sslmode === "verify-full") return true;
  const ssl = (params.get("ssl") ?? "").toLowerCase();
  return ssl === "true" || ssl === "1" || ssl === "require" || ssl === "verify-full";
}

const envSchemaChecked = envSchema.superRefine((value, ctx) => {
  // Step 1A: never trust every peer's X-Forwarded-For in production.
  if (value.NODE_ENV === "production" && /^true$/i.test(value.TRUST_PROXY.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["TRUST_PROXY"],
      message:
        'TRUST_PROXY="true" trusts X-Forwarded-For from any peer and lets a direct client spoof its rate-limit identity. ' +
        'In production set an explicit allow-list instead (e.g. "loopback" when Nginx/Caddy runs on the same host, or a CIDR).',
    });
  }

  // Everything below is a PRODUCTION-only floor — dev / test are untouched.
  if (value.NODE_ENV !== "production") return;

  const requireStrongSecret = (
    key: "INTERNAL_API_KEY" | "LIRYA_API_KEY" | "PRODUCT_PAGE_PREVIEW_SECRET",
    secret: string,
  ) => {
    if (secret.length < MIN_PROD_SECRET_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} must be at least ${MIN_PROD_SECRET_LENGTH} characters in production — generate one with: openssl rand -hex 32`,
      });
    }
    if (looksLikePlaceholder(secret)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} looks like a placeholder — set a real random secret in production.`,
      });
    }
  };

  requireStrongSecret("INTERNAL_API_KEY", value.INTERNAL_API_KEY);

  // Lirya key only matters when the integration is configured.
  if (value.LIRYA_API_KEY !== undefined) {
    requireStrongSecret("LIRYA_API_KEY", value.LIRYA_API_KEY);
  }

  // PRODUCT_PAGE_PREVIEW_SECRET: required in production, and never a silent
  // reuse of INTERNAL_API_KEY.
  if (value.PRODUCT_PAGE_PREVIEW_SECRET === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PRODUCT_PAGE_PREVIEW_SECRET"],
      message:
        "PRODUCT_PAGE_PREVIEW_SECRET is required in production — set a DISTINCT random secret (>= 32 chars), not a copy of INTERNAL_API_KEY.",
    });
  } else {
    requireStrongSecret("PRODUCT_PAGE_PREVIEW_SECRET", value.PRODUCT_PAGE_PREVIEW_SECRET);
    if (value.PRODUCT_PAGE_PREVIEW_SECRET === value.INTERNAL_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PRODUCT_PAGE_PREVIEW_SECRET"],
        message: "PRODUCT_PAGE_PREVIEW_SECRET must not equal INTERNAL_API_KEY in production — use a distinct secret.",
      });
    }
  }

  // Step 4 M4: a remote production database must use TLS.
  if (!databaseHostIsLocal(value.DATABASE_URL) && !databaseUrlHasTls(value.DATABASE_URL)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DATABASE_URL"],
      message:
        "DATABASE_URL points at a remote host with no TLS directive. Append ?sslmode=require (or ?ssl=true) so the connection is encrypted; a loopback/unix-socket DB is exempt.",
    });
  }
});

export type Env = z.infer<typeof envSchema>;

// Exported for tests: run the full schema (base + production floor) against
// an arbitrary source without touching process.env or exiting the process.
export function parseEnv(source: Record<string, unknown>) {
  return envSchemaChecked.safeParse(source);
}

function loadEnv(): Env {
  const parsed = parseEnv(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      // eslint-disable-next-line no-console
      console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    process.exit(1);
  }

  const value = parsed.data;

  // Non-fatal: a bind-all HOST in production is legitimate for a split-host
  // deployment, but a footgun for the co-located topology. Warn loudly.
  if (value.NODE_ENV === "production" && (value.HOST === "0.0.0.0" || value.HOST === "::")) {
    // eslint-disable-next-line no-console
    console.warn(
      `[env] HOST=${value.HOST} binds every network interface. In the co-located topology ` +
        `(Nginx → Next.js → this backend) set HOST=127.0.0.1 and firewall PORT ${value.PORT} from ` +
        `the public internet — the backend must not be directly reachable. See DEPLOYMENT.md.`,
    );
  }

  return value;
}

export const env = loadEnv();

// The admin origin allow-list for CORS and CSRF. Prefers the explicit
// ADMIN_TRUSTED_ORIGINS list; otherwise the single legacy CORS_ADMIN_ORIGIN.
// Origins are normalized (no trailing slash) and de-duplicated. Never
// contains "*".
export function adminAllowedOrigins(): string[] {
  const raw = env.ADMIN_TRUSTED_ORIGINS
    ? env.ADMIN_TRUSTED_ORIGINS.split(",")
    : [env.CORS_ADMIN_ORIGIN];
  const normalized = raw
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter((value) => value.length > 0 && value !== "*");
  return [...new Set(normalized)];
}

// Fastify's `trustProxy` accepts `boolean | string` (a single IP/CIDR, a
// comma-separated list, or a named range). We take the same via TRUST_PROXY
// and only special-case the two boolean spellings.
export function trustProxyOption(): boolean | string {
  const raw = env.TRUST_PROXY.trim();
  if (/^true$/i.test(raw)) return true; // dev / test convenience only — refused in prod by loadEnv()
  if (/^false$/i.test(raw)) return false; // no proxy in front — use the raw socket address
  return raw;
}

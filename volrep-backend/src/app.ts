import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import type { IncomingHttpHeaders } from "node:http";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { adminAllowedOrigins, env, trustProxyOption } from "./config/env.js";
import { isTrustedInternalRequest } from "./lib/internal-auth.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerSecurityHeaders } from "./plugins/security-headers.js";
import { healthRoutes } from "./routes/health.js";
import { productRoutes } from "./routes/products.js";
import { productPageRoutes } from "./routes/product-page.js";
import { homepageRoutes } from "./routes/homepage.js";
import { cartRoutes } from "./routes/cart.js";
import { checkoutRoutes } from "./routes/checkout.js";
import { orderRoutes } from "./routes/orders.js";
import { reviewRoutes } from "./routes/reviews.js";
import { storeSettingsRoutes } from "./routes/store-settings.js";
import { adminRoutes } from "./routes/admin/index.js";

// Pino redaction paths (security hardening — Step 4 L2). Fastify's default
// req/res serializers already emit only method/url/status/remoteAddress —
// never headers, cookies or bodies — and no current log statement passes a
// secret to the logger. This is the CENTRALIZED safety net: if a future
// log line ever carries `{ req }`, `{ headers }`, a custom serializer or a
// request/response body, these paths guarantee the internal API key, an
// admin session cookie (the raw M1 bearer token), an `Authorization`
// bearer, a `Set-Cookie`, or a password field are written as "[Redacted]"
// instead of in cleartext. Paths that never match are harmless no-ops.
const LOG_REDACT_PATHS: string[] = [
  // Bare keys — an object logged as `{ authorization }`, `{ cookie }`, etc.
  "authorization",
  "cookie",
  "password",
  '["set-cookie"]',
  '["x-internal-api-key"]',
  // Nested request/response header shapes. Fastify's own `req`/`res`
  // serializers already strip headers before this runs, but `request` /
  // `response` (spelled out) are NOT serializer keys, and a non-Fastify
  // pino consumer may log `{ req: rawObject }` — so cover both.
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["set-cookie"]',
  'req.headers["x-internal-api-key"]',
  'req.headers["proxy-authorization"]',
  "request.headers.authorization",
  "request.headers.cookie",
  'request.headers["set-cookie"]',
  'request.headers["x-internal-api-key"]',
  'request.headers["proxy-authorization"]',
  "headers.authorization",
  "headers.cookie",
  'headers["set-cookie"]',
  'headers["x-internal-api-key"]',
  'headers["proxy-authorization"]',
  'res.headers["set-cookie"]',
  'response.headers["set-cookie"]',
  // One-level catch-alls for any other object logged with these keys.
  "*.authorization",
  "*.cookie",
  '*["set-cookie"]',
  '*["x-internal-api-key"]',
  // Credential fields if a request/response body is ever logged.
  "req.body.password",
  "request.body.password",
  "body.password",
  "*.password",
];

// The `preview` (and, defensively, `token`) query-param VALUE is a
// short-lived signed bearer token that unlocks a product's UNPUBLISHED
// draft page (src/lib/product-page/preview-token.ts). The storefront
// passes it in the request URL, and L2's redaction covers headers /
// cookies / bodies but NOT the URL — so without this it would be written
// to the request log in cleartext (security hardening — Step 4 L4).
function maskSensitiveQueryParams(url: string): string {
  return url.replace(/([?&](?:preview|token)=)[^&#]*/gi, "$1[Redacted]");
}

// Fastify 5's built-in request-log serializer, field-for-field, with the
// single change above applied to `url`. `headers` is still never emitted,
// so L2's guarantees are unchanged. Every field is spread only when
// present, both to match Fastify's own `req.headers && …` defensiveness
// and to satisfy exactOptionalPropertyTypes.
type LoggableRequest = {
  method?: string | undefined;
  url?: string | undefined;
  headers?: IncomingHttpHeaders | undefined;
  host?: string | undefined;
  ip?: string | undefined;
  socket?: { remotePort?: number | undefined } | undefined;
};

function reqSerializer(request: LoggableRequest) {
  const version = request.headers?.["accept-version"];
  const remotePort = request.socket?.remotePort;
  return {
    ...(typeof request.method === "string" ? { method: request.method } : {}),
    ...(typeof request.url === "string" ? { url: maskSensitiveQueryParams(request.url) } : {}),
    ...(typeof request.host === "string" ? { host: request.host } : {}),
    ...(typeof request.ip === "string" ? { remoteAddress: request.ip } : {}),
    ...(typeof version === "string" ? { version } : {}),
    ...(typeof remotePort === "number" ? { remotePort } : {}),
  };
}

// Built conditionally, not with `transport: ... ? X : undefined` — under
// exactOptionalPropertyTypes, explicitly assigning `undefined` to an
// optional key is a different (rejected) type than omitting the key.
// Pretty-print only in development; production ships plain structured
// JSON for the VPS's log pipeline (Architecture §13). Exported so the L2
// redaction test can drive the exact same options through a real pino
// stream (src/app.log-redaction.test.ts).
export function buildLoggerOptions() {
  // Method shorthand (not `req:` arrow) so the parameter is checked
  // bivariantly — Fastify types the serializer arg as the raw Node
  // request, but at runtime passes the decorated FastifyRequest.
  const serializers = {
    req(request: LoggableRequest) {
      return reqSerializer(request);
    },
  };
  if (env.NODE_ENV === "development") {
    return {
      level: env.LOG_LEVEL,
      redact: LOG_REDACT_PATHS,
      serializers,
      transport: { target: "pino-pretty" },
    } as const;
  }
  return { level: env.LOG_LEVEL, redact: LOG_REDACT_PATHS, serializers } as const;
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: buildLoggerOptions(),
    // Was `trustProxy: true`, which believes an `X-Forwarded-For` from ANY
    // peer — a direct internet client could then choose the IP used for
    // rate limiting. Now an explicit allow-list (TRUST_PROXY, default
    // "loopback") matching the production topology: Internet → Nginx/Caddy
    // on the same host → this backend. For any peer not on the list,
    // `request.ip` falls back to the raw socket address (security
    // hardening — Step 1A).
    trustProxy: trustProxyOption(),
  });

  registerErrorHandler(app);
  registerSecurityHeaders(app);

  // Storefront routes are never called from a browser (Architecture §01) —
  // CORS here exists only to protect the admin surface, which is the one
  // caller that IS a browser. Explicit origin allow-list, credentials on,
  // never a wildcard (a wildcard + credentials is rejected by the spec and
  // by @fastify/cors anyway).
  await app.register(cors, {
    origin: adminAllowedOrigins(),
    credentials: true,
  });

  await app.register(cookie);

  // Product-media uploads (Phase 7C-2). One file per request, capped at
  // MEDIA_MAX_BYTES — a larger file is truncated and rejected in the route.
  await app.register(multipart, {
    // Ceiling for the busboy stream: the largest thing any route accepts (an
    // MP4 for a "Page produit" video slot). Each route still enforces its own
    // per-type cap (images: MEDIA_MAX_BYTES) after the upload lands.
    limits: {
      fileSize: Math.max(env.MEDIA_MAX_BYTES, env.MEDIA_VIDEO_MAX_BYTES, env.MEDIA_GIF_MAX_BYTES),
      files: 1,
      fields: 5,
    },
  });

  // Local media driver: serve the uploaded files back at /media/*. In
  // production with the s3 driver the bucket/CDN serves media directly and
  // this block is skipped.
  if (env.MEDIA_STORAGE_DRIVER === "local") {
    const root = resolve(env.MEDIA_LOCAL_DIR);
    mkdirSync(root, { recursive: true });
    await app.register(fastifyStatic, {
      root,
      prefix: "/media/",
      decorateReply: false,
      index: false,
      cacheControl: true,
      maxAge: "365d",
      immutable: true, // filenames are content-addressed (sha256)
    });
  }

  // Global baseline for unauthenticated / direct traffic. The login, COD and
  // order-tracking routes apply their own stricter per-route limits on top.
  //
  // `allowList`: authenticated server-to-server calls from our own Next.js
  // frontend (correct x-internal-api-key) are exempt from THIS global
  // limiter only. In production every storefront request reaches the backend
  // from the single Next server IP, so without this they would all share one
  // 100/min bucket and the storefront would 429 itself under normal load
  // (security hardening — Step 4 H1). Exemption is scoped to the global
  // limiter: the per-route limiters (src/routes/admin/auth.ts,
  // src/routes/checkout.ts, src/routes/orders.ts) override it with
  // `allowList: []` so they stay effective for the internal caller too.
  // Unauthenticated / direct traffic is unaffected and still capped at 100/min.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    allowList: (request) => isTrustedInternalRequest(request),
  });

  await app.register(healthRoutes);
  await app.register(productRoutes);
  await app.register(productPageRoutes);
  await app.register(homepageRoutes);
  await app.register(cartRoutes);
  await app.register(checkoutRoutes);
  await app.register(orderRoutes);
  await app.register(reviewRoutes);
  await app.register(storeSettingsRoutes);

  // Admin surface — session-cookie auth, entirely separate from the
  // storefront's x-internal-api-key (src/plugins/admin-auth.ts).
  await app.register(adminRoutes);

  return app;
}

import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

// Baseline HTTP security headers for the backend (security hardening —
// Step 2 §8). The backend serves JSON (every /api/* route) plus, with the
// local media driver, static files under /media/*. It is never a rendered
// HTML document, so the Content-Security-Policy can be maximally strict:
// `default-src 'none'` — a JSON body has nothing to load — plus
// `frame-ancestors 'none'` so an API error page can never be framed.
//
// Applied via an onSend hook so the headers land on EVERY response,
// including 4xx/5xx from the error handler and the static media files.
// HSTS is sent ONLY in production (never on localhost HTTP dev) and only
// with a positive max-age. `preload` is deliberately never added — see the
// Step 2 report for the domain-wide precondition. Pure + exported so both
// branches are unit-testable.
export function hstsHeaderValue(nodeEnv: string, maxAge: number): string | null {
  if (nodeEnv !== "production" || maxAge <= 0) return null;
  return `max-age=${maxAge}; includeSubDomains`;
}

export function registerSecurityHeaders(app: FastifyInstance): void {
  const hsts = hstsHeaderValue(env.NODE_ENV, env.HSTS_MAX_AGE);

  app.addHook("onSend", async (request, reply) => {
    // Fastify does not send X-Powered-By, but strip it defensively in case a
    // plugin ever adds one.
    reply.removeHeader("x-powered-by");

    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header(
      "Permissions-Policy",
      "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), " +
        "fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), " +
        "midi=(), payment=(), usb=()",
    );

    if (hsts) reply.header("Strict-Transport-Security", hsts);

    const isMedia = request.url.startsWith("/media/");
    if (isMedia) {
      // Product images/videos are loaded cross-origin by the storefront's
      // <img> / <video> / next/image, so they must be explicitly shareable.
      // `nosniff` above still applies — an uploaded file is served only as
      // its detected type. `sandbox` + `default-src 'none'` neutralise any
      // file that a browser might nonetheless try to treat as a document
      // (a GIF/HTML or SVG/HTML polyglot): scripts, forms and navigation are
      // all inert (security hardening — Step 3 §10).
      reply.header("Cross-Origin-Resource-Policy", "cross-origin");
      reply.header("Content-Security-Policy", "default-src 'none'; sandbox");
      reply.header("X-Frame-Options", "DENY");
    } else {
      reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
      reply.header("X-Frame-Options", "DENY");
      // same-site (not same-origin): the admin SPA calls this API directly
      // from the browser cross-origin but same-site (admin.<domain> →
      // api.<domain>, same registrable domain — see the SameSite=Strict
      // cookie rationale in routes/admin/auth.ts). CORP is checked on any
      // cross-origin fetch even after CORS approves it, so same-origin would
      // have the browser block every admin API response outright.
      reply.header("Cross-Origin-Resource-Policy", "same-site");
    }
  });
}

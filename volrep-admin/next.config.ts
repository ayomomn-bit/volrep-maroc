import type { NextConfig } from "next";

// The admin dashboard is a standalone Next.js app (port 3001). It talks to
// the existing Volrep Fastify backend directly from the browser with
// `credentials: "include"` — the backend's CORS allows this origin. There
// is no server-to-server secret here: the only credential is the
// httpOnly `volrep_admin_session` cookie the backend sets on login, which
// browser JavaScript can never read.

// --- Security headers (hardening — Step 2 §8-10) ----------------------
// Admin must never be framed (§9). CSP is emitted only for production
// builds — `next dev` needs 'unsafe-eval' + a dev websocket. The admin app
// has NO third-party scripts, analytics, fonts or iframes (system font
// stack, verified); the one external endpoint is the backend API, which
// must be in connect-src (and img-src, for uploaded media thumbnails).
// 'unsafe-inline' for script-src covers Next.js's own inline bootstrap;
// removing it needs a nonce middleware — deferred, see the Step 2 report.
const isProd = process.env.NODE_ENV === "production";

// Origin of the backend API the browser calls. Falls back to the dev
// backend; set NEXT_PUBLIC_ADMIN_API_URL for staging/production.
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "http://localhost:4000").origin;
  } catch {
    return "http://localhost:4000";
  }
})();

// img-src / media-src allow any HTTPS origin so the Product Studio media
// picker can preview an externally-hosted image / GIF / MP4 (the "URL
// externe" tab). These render as passive <img> / <video> and cannot execute
// script; connect-src stays pinned to self + the API (security hardening —
// Step 3 §18).
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${apiOrigin}`,
  `media-src 'self' blob: https: ${apiOrigin}`,
  "font-src 'self'",
  `connect-src 'self' ${apiOrigin}`,
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  ...(isProd
    ? [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

// Product media is served by the Volrep backend (dev: MEDIA_STORAGE_DRIVER
// =local at http://localhost:4000/media/*, prod: an object-storage / CDN
// origin). Allow that origin for next/image. Defaults to the dev backend;
// set MEDIA_IMAGE_ORIGIN in the environment for the VPS.
const mediaOrigin = process.env.MEDIA_IMAGE_ORIGIN ?? "http://localhost:4000";

function mediaRemotePattern(origin: string): RemotePattern {
  const u = new URL(origin);
  return {
    protocol: u.protocol.replace(":", "") as "http" | "https",
    hostname: u.hostname,
    ...(u.port ? { port: u.port } : {}),
    pathname: "/media/**",
  };
}

// The dev media origin resolves to a private IP (localhost); Next 16 blocks
// image optimization from private IPs as SSRF protection. Allow it ONLY
// when the configured media origin is itself local — a real VPS/CDN origin
// is a public host and never trips this.
const mediaIsLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(mediaOrigin).hostname);

// --- Security headers (hardening — Step 2 §8-10) ----------------------
// CSP is emitted only for production builds: `next dev` needs 'unsafe-eval'
// (React Refresh) and a websocket to the dev server, which a production CSP
// must not allow. The storefront has NO third-party scripts, analytics,
// iframes or client-side external fetches (verified), and next/font
// self-hosts Google Fonts at build time — so the only real relaxation is
// 'unsafe-inline' for Next.js's own inline bootstrap/RSC scripts. Removing
// that needs a nonce via middleware, which forces every route to
// dynamic rendering (the storefront relies on static/ISR) — deferred; see
// the Step 2 report.
const isProd = process.env.NODE_ENV === "production";

// img-src / media-src also allow any HTTPS origin: Product Studio's "URL
// externe" tab lets an admin reference an image / GIF / MP4 hosted anywhere,
// and the storefront renders those as passive <img> / <video> — which can
// never execute script. The script/connect/frame/object/base/form
// directives stay strict, so this is a deliberate, bounded relaxation
// (security hardening — Step 3 §18: external media URLs must keep working).
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "frame-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
  reactCompiler: true,
  // Do not advertise the framework.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    ...(mediaIsLocal ? { dangerouslyAllowLocalIP: true } : {}),
    remotePatterns: [
      // Volrep-owned product media (Phase 7C-2).
      mediaRemotePattern(mediaOrigin),
      // TEMPORARY. The brand logo and the hard-coded lifestyle / marketing
      // section imagery are still on the Shopify file CDN. Product photos
      // are migrating to Volrep media via `npm run media:migrate-shopify`
      // in the backend; this entry stays until the marketing imagery moves
      // too (Product Studio, 7C-3+).
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

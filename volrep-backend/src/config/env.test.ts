import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

// Step 4 Phase 2 — M3 (secret strength / placeholder rejection) and
// M4 (remote production DB must use TLS). All new rules are PRODUCTION-only;
// dev / test configs must keep working unchanged.

const HEX64 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01"; // openssl rand -hex 32 shape
const STRONG_32 = "Zx7Qw9Lp2Rn4Tv6Yb8Cm1Kd3Fg5Hj0Aa"; // 32 chars, no placeholder token
const STRONG_48 = STRONG_32 + "Uu2Ww4Yy6Xx8Zz0Ab"; // 50 chars, distinct from HEX64

type ParseResult = ReturnType<typeof parseEnv>;

function issuePaths(result: ParseResult): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

// A minimal, VALID production environment. Overrides may set a key to
// `undefined` to remove it entirely.
function prodEnv(overrides: Record<string, string | undefined> = {}): Record<string, string> {
  const merged: Record<string, string | undefined> = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://volrep:pw@localhost:5432/volrep",
    INTERNAL_API_KEY: HEX64,
    PRODUCT_PAGE_PREVIEW_SECRET: STRONG_48,
    CORS_ADMIN_ORIGIN: "https://admin.volrep.com",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;
}

describe("env schema — M3: INTERNAL_API_KEY strength", () => {
  it("accepts a valid 64-char hex secret in production", () => {
    expect(parseEnv(prodEnv()).success).toBe(true);
  });

  it("accepts an exactly-32-char secret in production", () => {
    expect(parseEnv(prodEnv({ INTERNAL_API_KEY: STRONG_32 })).success).toBe(true);
  });

  it("rejects a 16-char secret in production", () => {
    const r = parseEnv(prodEnv({ INTERNAL_API_KEY: "a".repeat(16) }));
    expect(r.success).toBe(false);
    expect(issuePaths(r)).toContain("INTERNAL_API_KEY");
  });

  it("rejects placeholder-style secrets in production (case-insensitive)", () => {
    const placeholders = [
      "replace-with-a-long-random-value-xxxxxxx",
      "CHANGEME-CHANGEME-CHANGEME-CHANGEME",
      "not-a-real-secret-not-a-real-secret-xx",
      "your-secret-your-secret-your-secret-xx",
      "placeholder-placeholder-placeholder-x",
      "example-example-example-example-exampl",
    ];
    for (const bad of placeholders) {
      const r = parseEnv(prodEnv({ INTERNAL_API_KEY: bad }));
      expect(r.success, bad).toBe(false);
      expect(issuePaths(r), bad).toContain("INTERNAL_API_KEY");
    }
  });
});

describe("env schema — M3: LIRYA_API_KEY strength", () => {
  it("applies the same >= 32 + no-placeholder floor when the integration is configured", () => {
    expect(parseEnv(prodEnv({ LIRYA_API_KEY: "b".repeat(16) })).success).toBe(false);
    expect(parseEnv(prodEnv({ LIRYA_API_KEY: "replace-with-a-real-lirya-key-000000000" })).success).toBe(false);
    expect(parseEnv(prodEnv({ LIRYA_API_KEY: "c".repeat(40) })).success).toBe(true);
  });

  it("does not require LIRYA_API_KEY when the integration is unconfigured", () => {
    expect(parseEnv(prodEnv()).success).toBe(true); // no LIRYA_API_KEY key at all
  });
});

describe("env schema — M3: PRODUCT_PAGE_PREVIEW_SECRET", () => {
  it("rejects a missing preview secret in production", () => {
    const r = parseEnv(prodEnv({ PRODUCT_PAGE_PREVIEW_SECRET: undefined }));
    expect(r.success).toBe(false);
    expect(issuePaths(r)).toContain("PRODUCT_PAGE_PREVIEW_SECRET");
  });

  it("rejects a preview secret that is a copy of INTERNAL_API_KEY (silent reuse)", () => {
    const r = parseEnv(prodEnv({ PRODUCT_PAGE_PREVIEW_SECRET: HEX64 }));
    expect(r.success).toBe(false);
    expect(issuePaths(r)).toContain("PRODUCT_PAGE_PREVIEW_SECRET");
  });

  it("rejects a short or placeholder preview secret in production", () => {
    expect(parseEnv(prodEnv({ PRODUCT_PAGE_PREVIEW_SECRET: "d".repeat(20) })).success).toBe(false);
    expect(
      parseEnv(prodEnv({ PRODUCT_PAGE_PREVIEW_SECRET: "changeme-preview-secret-000000000000" })).success,
    ).toBe(false);
  });

  it("accepts a distinct strong preview secret in production", () => {
    expect(parseEnv(prodEnv({ PRODUCT_PAGE_PREVIEW_SECRET: "e".repeat(48) })).success).toBe(true);
  });
});

describe("env schema — M4: remote production database must use TLS", () => {
  it("does not require TLS for a loopback / unix-socket database", () => {
    const localUrls = [
      "postgres://u:p@localhost:5432/db",
      "postgres://u:p@127.0.0.1:5432/db",
      "postgres://u:p@[::1]:5432/db",
      "postgresql://localhost/db",
    ];
    for (const url of localUrls) {
      expect(parseEnv(prodEnv({ DATABASE_URL: url })).success, url).toBe(true);
    }
  });

  it("rejects a remote production database with no TLS directive", () => {
    const r = parseEnv(prodEnv({ DATABASE_URL: "postgres://u:p@db.internal.example:5432/volrep" }));
    expect(r.success).toBe(false);
    expect(issuePaths(r)).toContain("DATABASE_URL");
  });

  it("rejects sslmode=prefer / allow (they fall back to plaintext)", () => {
    expect(
      parseEnv(prodEnv({ DATABASE_URL: "postgres://u:p@db.example:5432/v?sslmode=prefer" })).success,
    ).toBe(false);
    expect(
      parseEnv(prodEnv({ DATABASE_URL: "postgres://u:p@db.example:5432/v?sslmode=allow" })).success,
    ).toBe(false);
  });

  it("accepts a remote production database with an explicit TLS directive", () => {
    const tlsUrls = [
      "postgres://u:p@db.example:5432/v?sslmode=require",
      "postgres://u:p@db.example:5432/v?sslmode=verify-full",
      "postgres://u:p@db.example:5432/v?ssl=true",
    ];
    for (const url of tlsUrls) {
      expect(parseEnv(prodEnv({ DATABASE_URL: url })).success, url).toBe(true);
    }
  });
});

describe("env schema — dev / test stay compatible", () => {
  it("accepts a short INTERNAL_API_KEY in development", () => {
    const r = parseEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgres://localhost:5432/volrep_dev",
      INTERNAL_API_KEY: "dev-key-1234567890", // 18 chars — would fail in production
    });
    expect(r.success).toBe(true);
  });

  it("accepts the test-config shape (loopback DB, placeholder-ish key) under NODE_ENV=test", () => {
    const r = parseEnv({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://ayoub@localhost:5432/volrep_test",
      INTERNAL_API_KEY: "test-internal-api-key-not-a-real-secret",
    });
    expect(r.success).toBe(true);
  });

  it("does not enforce the preview-secret requirement outside production", () => {
    const r = parseEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgres://localhost/db",
      INTERNAL_API_KEY: "dev-key-1234567890",
    });
    expect(r.success).toBe(true);
  });

  it("does not enforce remote-DB TLS outside production", () => {
    const r = parseEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgres://u:p@db.remote.example:5432/x",
      INTERNAL_API_KEY: "dev-key-1234567890",
    });
    expect(r.success).toBe(true);
  });
});

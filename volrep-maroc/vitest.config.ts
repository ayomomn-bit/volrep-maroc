import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Minimal unit-test setup for the storefront's server-only data layer
// (`lib/backend/*`). The storefront has no browser/component test suite —
// UI is covered by typecheck + lint + build + Playwright regression — so
// this only runs `lib/**/*.test.ts`.
export default defineConfig({
  resolve: {
    // Mirror the `@/*` path alias from tsconfig.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // `lib/backend/client.ts` validates these at import time.
    env: {
      VOLREP_BACKEND_URL: "http://backend.test",
      VOLREP_INTERNAL_API_KEY: "test-internal-key-not-a-real-secret-000000",
    },
  },
});

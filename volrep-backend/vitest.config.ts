import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Schema/integration tests share one Postgres connection pool
    // (src/db/client.ts) and truncate tables between tests — running them
    // concurrently would race on that shared state.
    fileParallelism: false,
    hookTimeout: 15_000,
    testTimeout: 15_000,
  },
});

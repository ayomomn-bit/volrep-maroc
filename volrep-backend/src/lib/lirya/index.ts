import { env } from "../../config/env.js";
import { createLiryaClient } from "./client.js";
import type { LiryaClient } from "./types.js";

export { LiryaError } from "./errors.js";
export type { LiryaErrorCode } from "./errors.js";
export type { LiryaClient, LiryaPage, LiryaPageStatus } from "./types.js";

// Process-wide Lirya client, built lazily from env. Returns `null` when the
// integration is not configured (no LIRYA_API_BASE_URL / LIRYA_API_KEY) —
// callers then report "not configured" instead of failing.
let cached: LiryaClient | null | undefined;
let testOverride: LiryaClient | null | undefined;

export function getLiryaClient(): LiryaClient | null {
  if (testOverride !== undefined) return testOverride;
  if (cached !== undefined) return cached;

  if (!env.LIRYA_API_BASE_URL || !env.LIRYA_API_KEY) {
    cached = null;
    return cached;
  }

  cached = createLiryaClient({
    baseUrl: env.LIRYA_API_BASE_URL,
    apiKey: env.LIRYA_API_KEY,
    adminBaseUrl: env.LIRYA_ADMIN_BASE_URL,
    timeoutMs: env.LIRYA_TIMEOUT_MS,
  });
  return cached;
}

export function liryaConfigured(): boolean {
  return getLiryaClient() !== null;
}

// Test seam — pass a fake client, or `null` to simulate "not configured",
// or `undefined` to restore env-based resolution.
export function __setLiryaClientForTests(client: LiryaClient | null | undefined): void {
  testOverride = client;
  cached = undefined;
}

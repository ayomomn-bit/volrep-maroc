import type { FastifyInstance, InjectOptions } from "fastify";
import { buildApp } from "../app.js";
import { env } from "../config/env.js";

export async function createTestApp(): Promise<FastifyInstance> {
  return buildApp();
}

// Every storefront route requires this header (src/lib/internal-auth.ts) —
// tests that aren't specifically exercising the auth guard itself should
// use this so the header doesn't need repeating everywhere.
export function withAuth(options: InjectOptions): InjectOptions {
  return {
    ...options,
    headers: { ...options.headers, "x-internal-api-key": env.INTERNAL_API_KEY },
  };
}

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";
import { isTrustedInternalRequest, requireInternalApiKey } from "./internal-auth.js";

// Step 4 L1 — the internal API key is compared in constant time
// (crypto.timingSafeEqual over HMACs), not with `===` / `!==`. These
// tests pin the observable behaviour: exactly the same accept/reject
// outcomes and the same 401 as before, and no throw on a length mismatch.

const KEY = env.INTERNAL_API_KEY;
const reply = {} as FastifyReply;

function req(headerValue: string | string[] | undefined): FastifyRequest {
  return { headers: { "x-internal-api-key": headerValue } } as unknown as FastifyRequest;
}

describe("internal API key comparison (L1 — timingSafeEqual)", () => {
  it("accepts the correct key", async () => {
    expect(isTrustedInternalRequest(req(KEY))).toBe(true);
    await expect(requireInternalApiKey(req(KEY), reply)).resolves.toBeUndefined();
  });

  it("rejects a wrong key of the SAME length with the existing 401", async () => {
    const sameLen = "x".repeat(KEY.length);
    expect(sameLen.length).toBe(KEY.length);
    expect(isTrustedInternalRequest(req(sameLen))).toBe(false);
    await expect(requireInternalApiKey(req(sameLen), reply)).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a wrong-length key WITHOUT throwing a RangeError (timingSafeEqual length guard)", async () => {
    for (const bad of [KEY.slice(0, 4), KEY + "extra", "", "a"]) {
      expect(isTrustedInternalRequest(req(bad))).toBe(false);
      const err = await requireInternalApiKey(req(bad), reply).catch((e) => e);
      // The ONLY error is the app's generic 401 — never a crypto RangeError
      // ("Input buffers must have the same byte length").
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({ statusCode: 401, code: "UNAUTHORIZED" });
    }
  });

  it("rejects a correct PREFIX of the key (no early-exit acceptance)", async () => {
    expect(isTrustedInternalRequest(req(KEY.slice(0, KEY.length - 1)))).toBe(false);
  });

  it("treats a missing header exactly as before (reject / 401)", async () => {
    expect(isTrustedInternalRequest(req(undefined))).toBe(false);
    await expect(requireInternalApiKey(req(undefined), reply)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("treats a duplicated header (string[]) as invalid", async () => {
    expect(isTrustedInternalRequest(req([KEY, KEY]))).toBe(false);
    await expect(requireInternalApiKey(req([KEY, KEY]), reply)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("preserves the exact generic error message", async () => {
    const err = await requireInternalApiKey(req("nope"), reply).catch((e) => e);
    expect(err.message).toBe("Missing or invalid internal API key");
  });

  it("structurally: uses timingSafeEqual and no raw `=== env.INTERNAL_API_KEY`", () => {
    const src = readFileSync(fileURLToPath(new URL("./internal-auth.ts", import.meta.url)), "utf8");
    expect(src).toMatch(/timingSafeEqual/);
    expect(src).not.toMatch(/[!=]==\s*env\.INTERNAL_API_KEY/);
    expect(src).not.toMatch(/env\.INTERNAL_API_KEY\s*[!=]==/);
  });
});

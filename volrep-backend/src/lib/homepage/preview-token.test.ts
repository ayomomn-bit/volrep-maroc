import { describe, expect, it } from "vitest";
import { mintPreviewToken, verifyPreviewToken } from "../product-page/preview-token.js";
import { mintHomepagePreviewToken, verifyHomepagePreviewToken } from "./preview-token.js";

describe("homepage preview token", () => {
  it("round-trips", () => {
    const { token } = mintHomepagePreviewToken();
    expect(verifyHomepagePreviewToken(token)).toBe(true);
  });

  it("expires after 30 minutes", () => {
    const now = Date.now();
    const { token } = mintHomepagePreviewToken(now);
    expect(verifyHomepagePreviewToken(token, now + 29 * 60_000)).toBe(true);
    expect(verifyHomepagePreviewToken(token, now + 31 * 60_000)).toBe(false);
  });

  it("rejects a tampered signature / payload", () => {
    const { token } = mintHomepagePreviewToken();
    const [scope, exp] = token.split(".");
    expect(verifyHomepagePreviewToken(`${scope}.${exp}.deadbeef`)).toBe(false);
    expect(verifyHomepagePreviewToken("not-a-token")).toBe(false);
    expect(verifyHomepagePreviewToken("")).toBe(false);
  });

  it("reports a real expiry timestamp", () => {
    const now = 1_000_000_000_000;
    const { expiresAt } = mintHomepagePreviewToken(now);
    expect(new Date(expiresAt).getTime()).toBe(now + 30 * 60_000);
  });

  // Cross-scope isolation: a token minted for a real product (via the
  // generic product-page module, with an arbitrary uuid-shaped id) must
  // never verify against the homepage scope, and vice versa — see the
  // comment in preview-token.ts.
  it("a product-page token does not unlock the homepage preview", () => {
    const { token } = mintPreviewToken("11111111-1111-1111-1111-111111111111");
    expect(verifyHomepagePreviewToken(token)).toBe(false);
  });

  it("a homepage token cannot be used to unlock an arbitrary product's draft", () => {
    const { token } = mintHomepagePreviewToken();
    expect(verifyPreviewToken(token, "11111111-1111-1111-1111-111111111111")).toBe(false);
  });
});

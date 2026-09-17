import { describe, expect, it } from "vitest";
import { mintPreviewToken, verifyPreviewToken } from "./preview-token.js";

const PID = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("product-page preview token", () => {
  it("round-trips for the product it was minted for", () => {
    const { token } = mintPreviewToken(PID);
    expect(verifyPreviewToken(token, PID)).toBe(true);
  });

  it("is bound to the product id", () => {
    const { token } = mintPreviewToken(PID);
    expect(verifyPreviewToken(token, OTHER)).toBe(false);
  });

  it("expires after 30 minutes", () => {
    const now = Date.now();
    const { token } = mintPreviewToken(PID, now);
    expect(verifyPreviewToken(token, PID, now + 29 * 60_000)).toBe(true);
    expect(verifyPreviewToken(token, PID, now + 31 * 60_000)).toBe(false);
  });

  it("rejects a tampered signature / payload", () => {
    const { token } = mintPreviewToken(PID);
    const [pid, exp] = token.split(".");
    expect(verifyPreviewToken(`${pid}.${exp}.deadbeef`, PID)).toBe(false);
    expect(verifyPreviewToken(`${pid}.${Number(exp) + 1_000_000}.${token.split(".")[2]}`, PID)).toBe(false);
    expect(verifyPreviewToken("not-a-token", PID)).toBe(false);
    expect(verifyPreviewToken("", PID)).toBe(false);
  });

  it("reports a real expiry timestamp", () => {
    const now = 1_000_000_000_000;
    const { expiresAt } = mintPreviewToken(PID, now);
    expect(new Date(expiresAt).getTime()).toBe(now + 30 * 60_000);
  });
});

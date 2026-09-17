import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone.js";

describe("normalizePhone", () => {
  it("collapses the three Moroccan formats for one subscriber to a single key", () => {
    const canonical = "+212612345678";
    expect(normalizePhone("0612345678")).toBe(canonical);
    expect(normalizePhone("+212612345678")).toBe(canonical);
    expect(normalizePhone("00212612345678")).toBe(canonical);
  });

  it("ignores separators (spaces, dashes, dots, parentheses)", () => {
    expect(normalizePhone("06 12 34 56 78")).toBe("+212612345678");
    expect(normalizePhone("06-12-34-56-78")).toBe("+212612345678");
    expect(normalizePhone("+212 (6) 12.34.56.78")).toBe("+212612345678");
  });

  it("keeps distinct subscribers distinct", () => {
    expect(normalizePhone("0612345678")).not.toBe(normalizePhone("0612345679"));
    expect(normalizePhone("0612345678")).not.toBe(normalizePhone("0712345678"));
  });
});

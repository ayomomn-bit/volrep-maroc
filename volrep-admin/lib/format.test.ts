import { describe, expect, it } from "vitest";
import { formatMoney, humanize, orderStatusTone, paymentStatusTone } from "./format";

describe("formatMoney", () => {
  it("formats a MAD amount", () => {
    expect(formatMoney({ amount: "899.00", currencyCode: "MAD" })).toMatch(/899/);
  });
  it("returns a dash for null / NaN", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney({ amount: "nope", currencyCode: "MAD" })).toBe("—");
  });
});

describe("humanize", () => {
  it("turns enum strings into sentence case", () => {
    expect(humanize("pending_payment")).toBe("Pending payment");
    expect(humanize("partially_refunded")).toBe("Partially refunded");
  });
});

describe("status tones", () => {
  it("maps order statuses to tones", () => {
    expect(orderStatusTone("pending_payment")).toBe("warning");
    expect(orderStatusTone("fulfilled")).toBe("success");
    expect(orderStatusTone("canceled")).toBe("danger");
  });
  it("maps payment statuses", () => {
    expect(paymentStatusTone("paid")).toBe("success");
    expect(paymentStatusTone("pending")).toBe("warning");
  });
});

import { describe, expect, it } from "vitest";
import { SlidingWindowCounter } from "./abuse-guard.js";

describe("SlidingWindowCounter", () => {
  const WINDOW_MS = 30 * 60_000; // 30 minutes

  it("allows up to `max` hits per key in the window, then limits", () => {
    const counter = new SlidingWindowCounter(3, WINDOW_MS);
    const t0 = 1_000_000;

    expect(counter.hit("k", t0).limited).toBe(false);
    expect(counter.hit("k", t0 + 1).limited).toBe(false);
    expect(counter.hit("k", t0 + 2).limited).toBe(false);

    const fourth = counter.hit("k", t0 + 3);
    expect(fourth.limited).toBe(true);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks each key independently", () => {
    const counter = new SlidingWindowCounter(2, WINDOW_MS);
    const t0 = 5_000_000;

    counter.hit("a", t0);
    counter.hit("a", t0 + 1);
    expect(counter.hit("a", t0 + 2).limited).toBe(true);

    // A different key is unaffected.
    expect(counter.hit("b", t0 + 2).limited).toBe(false);
  });

  it("lets a key back in once the window has fully elapsed", () => {
    const counter = new SlidingWindowCounter(2, WINDOW_MS);
    const t0 = 9_000_000;

    counter.hit("k", t0 + 10);
    counter.hit("k", t0 + 11);
    expect(counter.hit("k", t0 + 12).limited).toBe(true);

    // Still inside the window of the first hit: still limited.
    expect(counter.hit("k", t0 + WINDOW_MS).limited).toBe(true);

    // Past the window of every recorded hit: ordering resumes.
    expect(counter.hit("k", t0 + WINDOW_MS + 20).limited).toBe(false);
  });

  it("does not let a client extend its own lockout by hammering", () => {
    const counter = new SlidingWindowCounter(1, WINDOW_MS);
    const t0 = 2_000_000;

    expect(counter.hit("k", t0).limited).toBe(false);
    // Blocked hits are NOT recorded, so the single allowed hit still ages
    // out exactly WINDOW_MS after t0 despite continuous hammering.
    for (let t = t0 + 1; t < t0 + WINDOW_MS; t += 60_000) {
      expect(counter.hit("k", t).limited).toBe(true);
    }
    expect(counter.hit("k", t0 + WINDOW_MS + 1).limited).toBe(false);
  });

  it("rejects nonsensical construction", () => {
    expect(() => new SlidingWindowCounter(0, WINDOW_MS)).toThrow();
    expect(() => new SlidingWindowCounter(3, 0)).toThrow();
    expect(() => new SlidingWindowCounter(3, WINDOW_MS, 0)).toThrow();
  });

  // ---- Step 4 M2 additions: peek / clear / bounded key map ----------

  it("peek(): a key at its limit self-heals once its oldest hit ages out (temporary lock)", () => {
    const counter = new SlidingWindowCounter(3, WINDOW_MS);
    const t0 = 12_000_000;

    counter.hit("acct", t0);
    counter.hit("acct", t0 + 5);
    counter.hit("acct", t0 + 10);

    expect(counter.peek("acct", t0 + 11).limited).toBe(true);
    // still locked deep inside the window …
    expect(counter.peek("acct", t0 + WINDOW_MS - 1).limited).toBe(true);
    // … but usable again once every recorded hit has aged out.
    expect(counter.peek("acct", t0 + WINDOW_MS + 11).limited).toBe(false);
  });

  it("peek() reports the limit WITHOUT recording a hit", () => {
    const counter = new SlidingWindowCounter(2, WINDOW_MS);
    const t0 = 3_000_000;

    // Ten peeks never accumulate.
    for (let i = 0; i < 10; i++) expect(counter.peek("k", t0 + i).limited).toBe(false);

    // Real hits still take effect.
    counter.hit("k", t0 + 20);
    counter.hit("k", t0 + 21);
    expect(counter.peek("k", t0 + 22).limited).toBe(true);
    expect(counter.hit("k", t0 + 22).limited).toBe(true);
  });

  it("clear() drops one key's state without touching others", () => {
    const counter = new SlidingWindowCounter(2, WINDOW_MS);
    const t0 = 4_000_000;

    counter.hit("a", t0);
    counter.hit("a", t0 + 1);
    counter.hit("b", t0 + 1);
    counter.hit("b", t0 + 2);
    expect(counter.peek("a", t0 + 3).limited).toBe(true);
    expect(counter.peek("b", t0 + 3).limited).toBe(true);

    counter.clear("a");
    expect(counter.peek("a", t0 + 3).limited).toBe(false); // "a" reset
    expect(counter.peek("b", t0 + 3).limited).toBe(true); // "b" untouched
  });

  it("bounds the key map: hammering many distinct keys evicts the stalest (LRU)", () => {
    const MAX_KEYS = 8;
    const counter = new SlidingWindowCounter(3, WINDOW_MS, MAX_KEYS);
    const t0 = 6_000_000;

    // Push key "victim" to its limit, then flood far more than MAX_KEYS
    // other keys within the same window.
    counter.hit("victim", t0);
    counter.hit("victim", t0 + 1);
    counter.hit("victim", t0 + 2);
    expect(counter.peek("victim", t0 + 3).limited).toBe(true);

    for (let i = 0; i < 500; i++) counter.hit(`flood-${i}`, t0 + 10 + i);

    // The map never exceeded the cap …
    expect(counter.size).toBeLessThanOrEqual(MAX_KEYS);
    // … and "victim" was evicted long ago, so its state is gone (not limited).
    expect(counter.peek("victim", t0 + 600).limited).toBe(false);
  });

  it("evicts the entry whose newest activity is oldest (not an arbitrary one)", () => {
    const counter = new SlidingWindowCounter(5, WINDOW_MS, 3);
    const t0 = 7_000_000;

    counter.hit("old", t0);
    counter.hit("mid", t0 + 100);
    counter.hit("new", t0 + 200); // size now 3 (at cap)

    counter.hit("newest", t0 + 300); // triggers one eviction → "old" goes

    expect(counter.size).toBe(3);
    expect(counter.peek("old", t0 + 400).limited).toBe(false); // "old" state gone
    // The two more-recent keys survived.
    expect(counter.hit("mid", t0 + 400).limited).toBe(false);
    expect(counter.hit("new", t0 + 400).limited).toBe(false);
  });

  it("the default (unbounded) constructor is unchanged for the COD-style usage", () => {
    // Same call shape src/routes/checkout.ts uses — 2 args, hit() only.
    const counter = new SlidingWindowCounter(5, WINDOW_MS);
    const t0 = 8_000_000;
    for (let i = 0; i < 1000; i++) counter.hit(`phone-${i}`, t0 + i);
    expect(counter.size).toBe(1000); // no eviction when maxKeys is Infinity

    for (let i = 0; i < 5; i++) expect(counter.hit("phone-x", t0 + 2000 + i).limited).toBe(false);
    expect(counter.hit("phone-x", t0 + 2010).limited).toBe(true);
  });
});

// A tiny in-memory sliding-window counter.
//
// Deliberately NOT backed by Redis or any shared store (security hardening —
// Step 1F): the initial VPS runs a single backend process, so a
// process-local Map is sufficient and adds no infrastructure. The trade-off,
// documented for later horizontal scaling:
//   • counts are per process — a second backend instance would not share them
//   • counts reset on restart
//
// Used for the per-phone COD order abuse guard (Step 1) and the per-account
// admin-login throttle (Step 4 M2). IP-based limiting stays with
// @fastify/rate-limit; this covers dimensions that plugin cannot key on — a
// value that only exists in the request body, or an identity that must be
// tracked across many source IPs.
export type AbuseVerdict = {
  limited: boolean;
  // Seconds until the oldest hit in the window ages out. 0 when not limited.
  retryAfterSeconds: number;
};

export class SlidingWindowCounter {
  private readonly hits = new Map<string, number[]>();
  private readonly max: number;
  private readonly windowMs: number;
  // Hard ceiling on the number of distinct keys tracked at once. Default:
  // unbounded (the COD guard keys on a phone number — a tiny domain). Set a
  // finite value when the key space is attacker-controlled (e.g. an email
  // for the admin-login throttle) so hammering junk keys cannot exhaust
  // memory: the least-recently-touched entry is evicted when the cap is hit.
  private readonly maxKeys: number;
  private lastSweep = 0;

  constructor(max: number, windowMs: number, maxKeys: number = Number.POSITIVE_INFINITY) {
    if (max < 1) throw new Error("SlidingWindowCounter: max must be >= 1");
    if (windowMs < 1) throw new Error("SlidingWindowCounter: windowMs must be >= 1");
    if (maxKeys < 1) throw new Error("SlidingWindowCounter: maxKeys must be >= 1");
    this.max = max;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  // Records one hit for `key` and reports whether the caller is now over the
  // limit. When already at the limit the hit is NOT recorded, so a client
  // that stops for `windowMs` is always let back in (it can never extend its
  // own lockout by hammering). `now` is injectable for tests.
  hit(key: string, now: number = Date.now()): AbuseVerdict {
    this.sweep(now);

    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (recent.length >= this.max) {
      const retryAfterMs = recent[0]! + this.windowMs - now;
      return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }

    recent.push(now);
    // Bound the key map: when a FINITE maxKeys is set and a brand-new key
    // would push us over, evict the entry whose most recent activity is
    // furthest in the past. The default (unbounded) path is a plain set() —
    // byte-identical to before for the COD guard.
    if (Number.isFinite(this.maxKeys) && !this.hits.has(key) && this.hits.size >= this.maxKeys) {
      this.evictStalest();
    }
    this.hits.set(key, recent);
    return { limited: false, retryAfterSeconds: 0 };
  }

  // Reports whether `key` is currently over the limit WITHOUT recording a
  // hit. Used where the check and the "record a failure" step are separate
  // (admin-login throttle: peek before verifying, hit() only on failure,
  // clear() on success).
  peek(key: string, now: number = Date.now()): AbuseVerdict {
    this.sweep(now);

    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (recent.length >= this.max) {
      const retryAfterMs = recent[0]! + this.windowMs - now;
      return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }
    return { limited: false, retryAfterSeconds: 0 };
  }

  // Drops all recorded state for one key (e.g. after a successful login).
  clear(key: string): void {
    this.hits.delete(key);
  }

  // Number of distinct keys currently tracked — for the bounded-memory
  // invariant test and any future monitoring.
  get size(): number {
    return this.hits.size;
  }

  // Test seam — drop all recorded state.
  reset(): void {
    this.hits.clear();
    this.lastSweep = 0;
  }

  // Remove the tracked key whose newest recorded hit is furthest in the
  // past. O(size), but only runs when a bounded map is already at its cap
  // (i.e. under a distinct-key flood). Trade-off documented on `maxKeys`: a
  // determined botnet flooding >maxKeys junk keys within one window could
  // evict a genuinely-locked account's counter — it then falls back to the
  // per-IP limiter + argon2, still bounded, and the attacker gained at most
  // `max` extra guesses on that one account.
  private evictStalest(): void {
    let victim: string | undefined;
    let victimNewest = Number.POSITIVE_INFINITY;
    for (const [key, timestamps] of this.hits) {
      const newest = timestamps.length > 0 ? timestamps[timestamps.length - 1]! : 0;
      if (newest < victimNewest) {
        victimNewest = newest;
        victim = key;
      }
    }
    if (victim !== undefined) this.hits.delete(victim);
  }

  // Opportunistic GC so a client cycling through many key values can't grow
  // the Map without bound. At most one pass per window.
  private sweep(now: number): void {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;

    const cutoff = now - this.windowMs;
    for (const [key, timestamps] of this.hits) {
      const alive = timestamps.filter((timestamp) => timestamp > cutoff);
      if (alive.length === 0) this.hits.delete(key);
      else this.hits.set(key, alive);
    }
  }
}

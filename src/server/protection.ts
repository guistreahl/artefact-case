import { timingSafeEqual } from "node:crypto";

/** Header Cloudflare adds to every request that goes through it. */
export const ORIGIN_HEADER = "x-origin-secret";

/**
 * Checks that the request went through Cloudflare.
 *
 * With no secret configured (development, tests, anyone running the project
 * locally), everything passes. In production the secret comes from Secret
 * Manager and only Cloudflare knows it. Constant-time comparison, so the
 * response time does not reveal how many characters were right.
 */
export function isAllowedOrigin(received: string | null, secret: string | undefined): boolean {
  if (!secret) return true;
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Request limit per key over a sliding window.
 *
 * Works in memory because the service runs a single instance (the same
 * constraint that keeps the task list consistent).
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
    private readonly maxKeys = 5000,
  ) {}

  /** Records an attempt and says whether it is within the limit. */
  allow(key: string): boolean {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.delete(key);
    this.hits.set(key, recent);
    // Too many different keys (varied IPs): drop the least recent ones.
    if (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next().value;
      if (oldest !== undefined) this.hits.delete(oldest);
    }
    return true;
  }
}

/**
 * Visitor IP. Behind Cloudflare it comes in cf-connecting-ip; without it, the
 * first address in x-forwarded-for, filled in by Cloud Run.
 */
export function clientIp(headers: Headers): string | undefined {
  return headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
}

// 120 changes per minute per IP: plenty for a person (and for the browser
// tests, which all share one IP), tight for a script hammering the API.
const global = globalThis as typeof globalThis & { __mutationLimiter?: RateLimiter };
export const mutationLimiter = (global.__mutationLimiter ??= new RateLimiter(120, 60_000));

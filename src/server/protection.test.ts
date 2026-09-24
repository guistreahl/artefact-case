import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { createCaller } from "./root";
import { clientIp, isAllowedOrigin, RateLimiter } from "./protection";
import { TaskStore } from "./tasks/store";

describe("isAllowedOrigin", () => {
  it("with no secret configured, lets everything through (development and tests)", () => {
    expect(isAllowedOrigin(null, undefined)).toBe(true);
    expect(isAllowedOrigin("anything", "")).toBe(true);
  });

  it("with a secret, requires the exact value", () => {
    expect(isAllowedOrigin("right-secret", "right-secret")).toBe(true);
    expect(isAllowedOrigin(null, "right-secret")).toBe(false);
    expect(isAllowedOrigin("wrong-secret", "right-secret")).toBe(false);
    expect(isAllowedOrigin("right-secret-and-more", "right-secret")).toBe(false);
  });
});

describe("RateLimiter", () => {
  it("allows up to the maximum within the window and frees up once it passes", () => {
    let now = 0;
    const limiter = new RateLimiter(3, 1000, () => now);

    expect([1, 2, 3].map(() => limiter.allow("ip-a"))).toEqual([true, true, true]);
    expect(limiter.allow("ip-a")).toBe(false);
    expect(limiter.allow("ip-b")).toBe(true);

    now = 1000;
    expect(limiter.allow("ip-a")).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the IP reported by Cloudflare", () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("without Cloudflare, uses the first address in x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
    expect(clientIp(new Headers())).toBeUndefined();
  });
});

describe("change limit on procedures", () => {
  it("rejects with TOO_MANY_REQUESTS past the limit, while reads stay allowed", async () => {
    const caller = createCaller({
      session: "session-a",
      ip: "203.0.113.7",
      store: new TaskStore(),
      limiter: new RateLimiter(2, 60_000),
    });

    await caller.tasks.create({ titulo: "One" });
    await caller.tasks.create({ titulo: "Two" });
    const error = await caller.tasks.create({ titulo: "Three" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    await expect(caller.tasks.list({ limit: 1 })).resolves.toBeDefined();
  });
});

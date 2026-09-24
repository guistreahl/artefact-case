import { SESSION_COOKIE, type Context } from "./trpc";
import { store } from "./tasks/store";
import { clientIp, mutationLimiter } from "./protection";

/** Context for HTTP requests to /api/trpc. */
export function createRequestContext(req: Request): Context {
  return {
    session: readCookie(req.headers.get("cookie"), SESSION_COOKIE),
    store,
    limiter: mutationLimiter,
    ip: clientIp(req.headers),
  };
}

function readCookie(header: string | null, name: string): string | undefined {
  for (const pair of header?.split(";") ?? []) {
    const [key, ...value] = pair.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

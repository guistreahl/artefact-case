import { initTRPC, TRPCError } from "@trpc/server";
import { z, ZodError } from "zod";
import type { TaskStore } from "./tasks/store";
import type { RateLimiter } from "./protection";

export { SESSION_COOKIE } from "./session";

export type Context = {
  /** Anonymous visitor id, from the cookie the middleware issues. */
  session: string | undefined;
  store: TaskStore;
  /** Limits changes per visitor. Absent in the SSR's internal calls. */
  limiter?: RateLimiter;
  ip?: string;
};

const t = initTRPC.context<Context>().create({
  // Validation errors reach the client already split by field, so the form
  // shows each message under the right field.
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        validation: error.cause instanceof ZodError ? z.flattenError(error.cause) : null,
      },
    };
  },
});

export const createRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Every procedure requires a session. The middleware guarantees the cookie on
 * any request that goes through Next, so it can only be missing if someone
 * calls the API with cookies blocked.
 */
export const procedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Session not found. Enable cookies and reload the page.",
    });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/**
 * Procedures that change data: besides the session, they go through the
 * per-IP change limit (per session when the IP is unknown).
 */
export const mutationProcedure = procedure.use(({ ctx, next }) => {
  if (ctx.limiter && !ctx.limiter.allow(ctx.ip ?? ctx.session)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many changes in a short time. Wait a minute and try again.",
    });
  }
  return next();
});

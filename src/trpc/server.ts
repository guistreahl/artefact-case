import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { appRouter, createCaller } from "@/server/root";
import { SESSION_COOKIE, type Context } from "@/server/trpc";
import { store } from "@/server/tasks/store";
import { createQueryClient } from "./query-client";

/**
 * Context for Server Components. Calls the procedures directly, in the same
 * memory, without going through HTTP.
 */
const context = cache(async (): Promise<Context> => {
  const jar = await cookies();
  return { session: jar.get(SESSION_COOKIE)?.value, store };
});

// One QueryClient per request: React's cache() guarantees it is not shared
// between visitors.
export const getQueryClient = cache(createQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: context,
  router: appRouter,
  queryClient: getQueryClient,
});

export const caller = createCaller(context);

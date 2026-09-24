import { createCallerFactory, createRouter } from "./trpc";
import { tasksRouter } from "./tasks/router";

export const appRouter = createRouter({
  tasks: tasksRouter,
});

/** The only thing the frontend imports from the server: a type, no code. */
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);

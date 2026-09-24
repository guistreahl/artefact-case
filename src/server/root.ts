import { criarCaller, criarRouter } from "./trpc";
import { tarefasRouter } from "./tarefas/router";

export const appRouter = criarRouter({
  tarefas: tarefasRouter,
});

/** O único tipo que o frontend importa do servidor. Nenhum código vai junto. */
export type AppRouter = typeof appRouter;

export const createCaller = criarCaller(appRouter);

import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { appRouter, createCaller } from "@/server/root";
import { COOKIE_SESSAO, type Contexto } from "@/server/trpc";
import { repositorio } from "@/server/tarefas/store";
import { criarQueryClient } from "./query-client";

/**
 * Contexto para Server Components. Chama os procedimentos direto, na mesma
 * memória, sem passar por HTTP.
 */
const contexto = cache(async (): Promise<Contexto> => {
  const loja = await cookies();
  return { sessao: loja.get(COOKIE_SESSAO)?.value, repositorio };
});

// Um QueryClient por requisição: o cache() do React garante que ele não é
// compartilhado entre visitantes.
export const getQueryClient = cache(criarQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: contexto,
  router: appRouter,
  queryClient: getQueryClient,
});

export const caller = createCaller(contexto);

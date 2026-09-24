import { initTRPC, TRPCError } from "@trpc/server";
import { z, ZodError } from "zod";
import type { RepositorioTarefas } from "./tarefas/store";

export { COOKIE_SESSAO } from "./sessao";

export type Contexto = {
  /** Id anônimo do visitante, vindo do cookie emitido pelo middleware. */
  sessao: string | undefined;
  repositorio: RepositorioTarefas;
};

const t = initTRPC.context<Contexto>().create({
  // Erros de validação chegam ao cliente já separados por campo, para o
  // formulário mostrar cada mensagem embaixo do campo certo.
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        erroValidacao: error.cause instanceof ZodError ? z.flattenError(error.cause) : null,
      },
    };
  },
});

export const criarRouter = t.router;
export const criarCaller = t.createCallerFactory;

/**
 * Todo procedimento exige uma sessão. O middleware garante o cookie em
 * qualquer requisição que passe pelo Next, então a falta dele só acontece se
 * alguém chamar a API bloqueando cookies.
 */
export const procedimento = t.procedure.use(({ ctx, next }) => {
  if (!ctx.sessao) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sessão não encontrada. Ative os cookies e recarregue a página.",
    });
  }
  return next({ ctx: { ...ctx, sessao: ctx.sessao } });
});

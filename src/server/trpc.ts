import { initTRPC, TRPCError } from "@trpc/server";
import { z, ZodError } from "zod";
import type { RepositorioTarefas } from "./tarefas/store";
import type { LimitadorDeTaxa } from "./protecao";

export { COOKIE_SESSAO } from "./sessao";

export type Contexto = {
  /** Id anônimo do visitante, vindo do cookie emitido pelo middleware. */
  sessao: string | undefined;
  repositorio: RepositorioTarefas;
  /** Limita as alterações por visitante. Ausente nas chamadas internas do SSR. */
  limitador?: LimitadorDeTaxa;
  ip?: string;
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

/**
 * Procedimentos que alteram dados: além da sessão, passam pelo limite de
 * alterações por IP (ou por sessão, quando o IP não é conhecido).
 */
export const procedimentoDeAlteracao = procedimento.use(({ ctx, next }) => {
  if (ctx.limitador && !ctx.limitador.permitir(ctx.ip ?? ctx.sessao)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Muitas alterações em pouco tempo. Aguarde um minuto e tente de novo.",
    });
  }
  return next();
});

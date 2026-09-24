import { TRPCError } from "@trpc/server";
import { criarRouter, procedimento } from "../trpc";
import {
  atualizarTarefaSchema,
  dadosTarefaSchema,
  listarTarefasSchema,
  idSchema,
} from "./schema";
import { LimiteDeTarefasError } from "./store";
import { z } from "zod";

const porId = z.object({ id: idSchema });

function naoEncontrada(id: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `Tarefa ${id} não encontrada.` });
}

export const tarefasRouter = criarRouter({
  listar: procedimento
    .input(listarTarefasSchema)
    .query(({ ctx, input }) => ctx.repositorio.listar(ctx.sessao, input.cursor, input.limite)),

  obter: procedimento
    .input(porId)
    .query(({ ctx, input }) => ctx.repositorio.obter(ctx.sessao, input.id) ?? naoEncontrada(input.id)),

  criar: procedimento.input(dadosTarefaSchema).mutation(({ ctx, input }) => {
    try {
      return ctx.repositorio.criar(ctx.sessao, input);
    } catch (erro) {
      if (erro instanceof LimiteDeTarefasError) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: erro.message });
      }
      throw erro;
    }
  }),

  atualizar: procedimento
    .input(atualizarTarefaSchema)
    .mutation(
      ({ ctx, input: { id, ...dados } }) =>
        ctx.repositorio.atualizar(ctx.sessao, id, dados) ?? naoEncontrada(id),
    ),

  remover: procedimento.input(porId).mutation(({ ctx, input }) => {
    if (!ctx.repositorio.remover(ctx.sessao, input.id)) naoEncontrada(input.id);
    return { id: input.id };
  }),
});

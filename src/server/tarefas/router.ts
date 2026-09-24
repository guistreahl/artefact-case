import { TRPCError } from "@trpc/server";
import { criarRouter, procedimento, procedimentoDeAlteracao } from "../trpc";
import {
  atualizarTarefaSchema,
  concluirTarefaSchema,
  dadosTarefaSchema,
  listarTarefasSchema,
  moverTarefaSchema,
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

  criar: procedimentoDeAlteracao.input(dadosTarefaSchema).mutation(({ ctx, input }) => {
    try {
      return ctx.repositorio.criar(ctx.sessao, input);
    } catch (erro) {
      if (erro instanceof LimiteDeTarefasError) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: erro.message });
      }
      throw erro;
    }
  }),

  atualizar: procedimentoDeAlteracao
    .input(atualizarTarefaSchema)
    .mutation(
      ({ ctx, input: { id, ...dados } }) =>
        ctx.repositorio.atualizar(ctx.sessao, id, dados) ?? naoEncontrada(id),
    ),

  // Separado de `atualizar`: marcar na lista não reenvia título e descrição,
  // e não passa pela validação do formulário.
  concluir: procedimentoDeAlteracao
    .input(concluirTarefaSchema)
    .mutation(
      ({ ctx, input }) =>
        ctx.repositorio.definirConclusao(ctx.sessao, input.id, input.concluida) ??
        naoEncontrada(input.id),
    ),

  // NOT_FOUND tanto para a tarefa movida quanto para a referência `depoisDe`,
  // que pode ter sido excluída em outra aba.
  mover: procedimentoDeAlteracao
    .input(moverTarefaSchema)
    .mutation(
      ({ ctx, input }) =>
        ctx.repositorio.mover(ctx.sessao, input.id, input.depoisDe) ?? naoEncontrada(input.id),
    ),

  remover: procedimentoDeAlteracao.input(porId).mutation(({ ctx, input }) => {
    if (!ctx.repositorio.remover(ctx.sessao, input.id)) naoEncontrada(input.id);
    return { id: input.id };
  }),
});

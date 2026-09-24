import { z } from "zod";

// Este arquivo não importa nada do servidor. É o mesmo schema que valida o
// formulário no navegador e a entrada dos procedimentos no tRPC, então as
// duas pontas nunca discordam sobre o que é uma tarefa válida.

export const LIMITE_TITULO = 120;
export const LIMITE_DESCRICAO = 1000;

export const tituloSchema = z
  .string()
  .trim()
  .min(1, "Informe um título.")
  .max(LIMITE_TITULO, `O título pode ter até ${LIMITE_TITULO} caracteres.`);

// Descrição em branco é tratada como ausente, e não como uma string vazia.
export const descricaoSchema = z
  .string()
  .trim()
  .max(LIMITE_DESCRICAO, `A descrição pode ter até ${LIMITE_DESCRICAO} caracteres.`)
  .optional()
  .transform((valor) => (valor ? valor : undefined));

export const idSchema = z.string().min(1, "Informe o id da tarefa.").max(100);

export const dadosTarefaSchema = z.object({
  titulo: tituloSchema,
  descricao: descricaoSchema,
});

export const atualizarTarefaSchema = dadosTarefaSchema.extend({ id: idSchema });

export const concluirTarefaSchema = z.object({ id: idSchema, concluida: z.boolean() });

export const listarTarefasSchema = z.object({
  // null na primeira página: é o valor que o useInfiniteQuery envia.
  cursor: z.string().max(200).nullish(),
  limite: z.number().int().min(1).max(50).default(10),
});

export type DadosTarefa = z.infer<typeof dadosTarefaSchema>;

export type Tarefa = {
  id: string;
  titulo: string;
  descricao?: string;
  /** Campo além do mínimo do case. Toda tarefa nasce pendente. */
  concluida: boolean;
  /** ISO 8601, definido pelo servidor ao concluir e apagado ao reabrir. */
  dataConclusao?: string;
  /** ISO 8601, definido pelo servidor na criação. */
  dataCriacao: string;
};

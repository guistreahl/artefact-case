import { z } from "zod";

// This file imports nothing from the server. The same schema validates the
// form in the browser and the procedure input in tRPC, so both ends always
// agree on what a valid task is.
//
// Field names (titulo, descricao, dataCriacao) are the ones the case
// specifies. Fields added beyond the case follow the same convention so the
// model reads uniformly.

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 1000;

export const titleSchema = z
  .string()
  .trim()
  .min(1, "Enter a title.")
  .max(TITLE_MAX, `The title can have up to ${TITLE_MAX} characters.`);

// A blank description is treated as absent, not as an empty string.
export const descriptionSchema = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX, `The description can have up to ${DESCRIPTION_MAX} characters.`)
  .optional()
  .transform((value) => (value ? value : undefined));

export const idSchema = z.string().min(1, "Enter the task id.").max(100);

export const taskInputSchema = z.object({
  titulo: titleSchema,
  descricao: descriptionSchema,
});

export const updateTaskSchema = taskInputSchema.extend({ id: idSchema });

export const completeTaskSchema = z.object({ id: idSchema, concluida: z.boolean() });

export const moveTaskSchema = z.object({
  id: idSchema,
  /** The task that ends up right above after the move. null moves to the top. */
  after: idSchema.nullable(),
});

export const listTasksSchema = z.object({
  // null on the first page: it is what useInfiniteQuery sends.
  cursor: z.string().max(200).nullish(),
  limit: z.number().int().min(1).max(50).default(10),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

export type Task = {
  id: string;
  titulo: string;
  descricao?: string;
  /** Beyond the case's minimum. Every task starts pending. */
  concluida: boolean;
  /** ISO 8601, set by the server on completion and cleared on reopening. */
  dataConclusao?: string;
  /** ISO 8601, set by the server on creation. */
  dataCriacao: string;
  /**
   * Manual order in the list: lowest first. A fractional number, so moving a
   * task changes only that task and not every task after it.
   */
  posicao: number;
};

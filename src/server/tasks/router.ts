import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createRouter, mutationProcedure, procedure } from "../trpc";
import {
  completeTaskSchema,
  idSchema,
  listTasksSchema,
  moveTaskSchema,
  taskInputSchema,
  updateTaskSchema,
} from "./schema";
import { TaskLimitError } from "./store";

const byId = z.object({ id: idSchema });

function notFound(id: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `Task ${id} not found.` });
}

export const tasksRouter = createRouter({
  list: procedure
    .input(listTasksSchema)
    .query(({ ctx, input }) => ctx.store.list(ctx.session, input.cursor, input.limit)),

  get: procedure
    .input(byId)
    .query(({ ctx, input }) => ctx.store.get(ctx.session, input.id) ?? notFound(input.id)),

  create: mutationProcedure.input(taskInputSchema).mutation(({ ctx, input }) => {
    try {
      return ctx.store.create(ctx.session, input);
    } catch (error) {
      if (error instanceof TaskLimitError) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
      }
      throw error;
    }
  }),

  update: mutationProcedure
    .input(updateTaskSchema)
    .mutation(({ ctx, input: { id, ...input } }) => ctx.store.update(ctx.session, id, input) ?? notFound(id)),

  // Separate from `update`: ticking the box in the list does not resend title
  // and description, and does not go through the form validation.
  complete: mutationProcedure
    .input(completeTaskSchema)
    .mutation(
      ({ ctx, input }) => ctx.store.setCompleted(ctx.session, input.id, input.concluida) ?? notFound(input.id),
    ),

  // NOT_FOUND both for the moved task and for the `after` reference, which may
  // have been deleted in another tab.
  move: mutationProcedure
    .input(moveTaskSchema)
    .mutation(({ ctx, input }) => ctx.store.move(ctx.session, input.id, input.after) ?? notFound(input.id)),

  delete: mutationProcedure.input(byId).mutation(({ ctx, input }) => {
    if (!ctx.store.delete(ctx.session, input.id)) notFound(input.id);
    return { id: input.id };
  }),
});

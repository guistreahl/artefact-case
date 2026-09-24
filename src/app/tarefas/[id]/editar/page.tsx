import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { FormTarefa } from "@/components/FormTarefa";
import { caller } from "@/trpc/server";

export const metadata: Metadata = { title: "Editar tarefa" };

type Props = { params: Promise<{ id: string }> };

// SSR: a tarefa é carregada no servidor. Um id inexistente responde 404 antes
// de qualquer JavaScript rodar no navegador.
export default async function PaginaEditarTarefa({ params }: Props) {
  const { id } = await params;
  const tarefa = await caller.tarefas.obter({ id }).catch((erro: unknown) => {
    if (erro instanceof TRPCError && erro.code === "NOT_FOUND") notFound();
    throw erro;
  });

  return <FormTarefa tarefa={tarefa} />;
}

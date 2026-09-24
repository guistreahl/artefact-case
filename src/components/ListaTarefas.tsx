"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { TAMANHO_PAGINA } from "@/lib/constantes";
import { formatarData } from "@/lib/formatar";
import type { Tarefa } from "@/server/tarefas/schema";
import { Aviso, type DadosAviso } from "./Aviso";

type Props = { avisoInicial?: string };

export function ListaTarefas({ avisoInicial }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [aviso, setAviso] = useState<DadosAviso | null>(
    avisoInicial ? { tipo: "sucesso", mensagem: avisoInicial } : null,
  );
  const fecharAviso = useCallback(() => setAviso(null), []);

  // O aviso de "criada" ou "atualizada" chega pela URL. Depois de mostrado, a
  // URL é limpa para ele não reaparecer ao recarregar a página.
  useEffect(() => {
    if (avisoInicial) router.replace("/", { scroll: false });
  }, [avisoInicial, router]);

  // Mesmas opções do prefetch em app/page.tsx. A primeira página já está no
  // cache, vinda do servidor, então esta consulta não dispara requisição.
  const entrada = { limite: TAMANHO_PAGINA };
  const lista = useInfiniteQuery(
    trpc.tarefas.listar.infiniteQueryOptions(entrada, {
      getNextPageParam: (pagina) => pagina.proximoCursor,
    }),
  );
  const chaveLista = trpc.tarefas.listar.infiniteQueryKey(entrada);

  // Exclusão otimista: a tarefa sai da tela antes da resposta do servidor. Se
  // o servidor recusar, a lista volta ao estado anterior.
  const remover = useMutation(
    trpc.tarefas.remover.mutationOptions({
      onMutate: async ({ id }) => {
        await queryClient.cancelQueries({ queryKey: chaveLista });
        const anterior = queryClient.getQueryData(chaveLista);
        queryClient.setQueryData(chaveLista, (dados) =>
          dados && {
            ...dados,
            pages: dados.pages.map((p) => ({ ...p, itens: p.itens.filter((t) => t.id !== id) })),
          },
        );
        return { anterior };
      },
      onError: (erro, _variaveis, resultado) => {
        if (resultado?.anterior) queryClient.setQueryData(chaveLista, resultado.anterior);
        setAviso({ tipo: "erro", mensagem: `Não foi possível excluir: ${erro.message}` });
      },
      onSuccess: () => setAviso({ tipo: "sucesso", mensagem: "Tarefa excluída." }),
      onSettled: () => queryClient.invalidateQueries({ queryKey: trpc.tarefas.listar.pathKey() }),
    }),
  );

  // Rolagem infinita: um elemento vazio no fim da lista. Quando ele chega
  // perto da área visível, a próxima página é pedida.
  const sentinela = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = lista;
  useEffect(() => {
    const alvo = sentinela.current;
    if (!alvo || !hasNextPage) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const tarefas = lista.data?.pages.flatMap((p) => p.itens) ?? [];

  return (
    <section aria-labelledby="titulo-lista">
      <h1 id="titulo-lista" className="sr-only">
        Lista de tarefas
      </h1>
      <Aviso aviso={aviso} aoFechar={fecharAviso} />

      {lista.isError && !lista.data ? (
        <Falha mensagem={lista.error.message} aoTentarDeNovo={() => void lista.refetch()} />
      ) : tarefas.length === 0 ? (
        <Vazio />
      ) : (
        <ul className="space-y-3">
          {tarefas.map((tarefa) => (
            <ItemTarefa key={tarefa.id} tarefa={tarefa} aoExcluir={() => remover.mutate({ id: tarefa.id })} />
          ))}
        </ul>
      )}

      <div ref={sentinela} aria-hidden="true" />
      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
        {isFetchingNextPage
          ? "Carregando mais tarefas..."
          : lista.isFetchNextPageError
            ? (
                <button type="button" onClick={() => void fetchNextPage()} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Falha ao carregar mais. Tentar de novo
                </button>
              )
            : tarefas.length > 0 && !hasNextPage
              ? "Fim da lista."
              : null}
      </p>
    </section>
  );
}

function ItemTarefa({ tarefa, aoExcluir }: { tarefa: Tarefa; aoExcluir: () => void }) {
  return (
    <li
      data-testid="tarefa"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-medium break-words">{tarefa.titulo}</h2>
          {tarefa.descricao && (
            <p className="mt-1 text-sm whitespace-pre-line break-words text-slate-600 dark:text-slate-400">
              {tarefa.descricao}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Criada em <time dateTime={tarefa.dataCriacao}>{formatarData(tarefa.dataCriacao)}</time>
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-sm">
          <Link
            href={`/tarefas/${tarefa.id}/editar`}
            aria-label={`Editar ${tarefa.titulo}`}
            className="rounded-md px-2 py-1 font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-800"
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={aoExcluir}
            aria-label={`Excluir ${tarefa.titulo}`}
            className="rounded-md px-2 py-1 font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-slate-800"
          >
            Excluir
          </button>
        </div>
      </div>
    </li>
  );
}

function Vazio() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
      <p className="text-slate-600 dark:text-slate-400">Nenhuma tarefa por aqui.</p>
      <Link href="/tarefas/nova" className="mt-3 inline-block font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        Criar a primeira
      </Link>
    </div>
  );
}

function Falha({ mensagem, aoTentarDeNovo }: { mensagem: string; aoTentarDeNovo: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
      <p className="text-red-900 dark:text-red-100">Não foi possível carregar as tarefas: {mensagem}</p>
      <button type="button" onClick={aoTentarDeNovo} className="mt-3 font-medium text-red-700 hover:underline dark:text-red-300">
        Tentar de novo
      </button>
    </div>
  );
}

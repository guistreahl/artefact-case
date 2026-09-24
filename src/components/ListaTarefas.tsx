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
import { ConfirmarExclusao } from "./ConfirmarExclusao";

type Props = { avisoInicial?: string };

export function ListaTarefas({ avisoInicial }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [aviso, setAviso] = useState<DadosAviso | null>(
    avisoInicial ? { tipo: "sucesso", mensagem: avisoInicial } : null,
  );
  const fecharAviso = useCallback(() => setAviso(null), []);
  const [paraExcluir, setParaExcluir] = useState<Tarefa | null>(null);

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

  // Aplica uma mudança a uma tarefa em todas as páginas já carregadas.
  const alterarNoCache = useCallback(
    (alterar: (itens: Tarefa[]) => Tarefa[]) =>
      queryClient.setQueryData(chaveLista, (dados) =>
        dados && { ...dados, pages: dados.pages.map((p) => ({ ...p, itens: alterar(p.itens) })) },
      ),
    [queryClient, chaveLista],
  );

  // Exclusão e conclusão são otimistas: a tela muda antes da resposta do
  // servidor. Se o servidor recusar, a lista volta ao estado anterior.
  const remover = useMutation(
    trpc.tarefas.remover.mutationOptions({
      onMutate: async ({ id }) => {
        await queryClient.cancelQueries({ queryKey: chaveLista });
        const anterior = queryClient.getQueryData(chaveLista);
        alterarNoCache((itens) => itens.filter((t) => t.id !== id));
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

  const concluir = useMutation(
    trpc.tarefas.concluir.mutationOptions({
      onMutate: async ({ id, concluida }) => {
        await queryClient.cancelQueries({ queryKey: chaveLista });
        const anterior = queryClient.getQueryData(chaveLista);
        // Horário provisório, do relógio do navegador. O do servidor substitui
        // este assim que a resposta chega.
        const dataConclusao = concluida ? new Date().toISOString() : undefined;
        alterarNoCache((itens) =>
          itens.map((t) => (t.id === id ? { ...t, concluida, dataConclusao } : t)),
        );
        return { anterior };
      },
      onSuccess: (tarefa) => alterarNoCache((itens) => itens.map((t) => (t.id === tarefa.id ? tarefa : t))),
      onError: (erro, _variaveis, resultado) => {
        if (resultado?.anterior) queryClient.setQueryData(chaveLista, resultado.anterior);
        setAviso({ tipo: "erro", mensagem: `Não foi possível atualizar: ${erro.message}` });
      },
      // Sem aviso de sucesso: o próprio círculo marcado já é a confirmação.
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
    <section aria-label="Lista de tarefas">
      <Aviso aviso={aviso} aoFechar={fecharAviso} />

      {lista.isError && !lista.data ? (
        <Falha mensagem={lista.error.message} aoTentarDeNovo={() => void lista.refetch()} />
      ) : tarefas.length === 0 ? (
        <Vazio />
      ) : (
        <ul className="space-y-3">
          {tarefas.map((tarefa) => (
            <ItemTarefa
              key={tarefa.id}
              tarefa={tarefa}
              aoConcluir={(concluida) => concluir.mutate({ id: tarefa.id, concluida })}
              aoExcluir={() => setParaExcluir(tarefa)}
            />
          ))}
        </ul>
      )}

      <ConfirmarExclusao
        tarefa={paraExcluir}
        aoConfirmar={(tarefa) => {
          setParaExcluir(null);
          remover.mutate({ id: tarefa.id });
        }}
        aoFechar={() => setParaExcluir(null)}
      />

      <div ref={sentinela} aria-hidden="true" />
      <p className="texto-suave py-6 text-center text-sm" aria-live="polite">
        {isFetchingNextPage
          ? "Carregando mais tarefas..."
          : lista.isFetchNextPageError
            ? (
                <button type="button" onClick={() => void fetchNextPage()} className="link-acao">
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

type PropsItem = {
  tarefa: Tarefa;
  aoConcluir: (concluida: boolean) => void;
  aoExcluir: () => void;
};

function ItemTarefa({ tarefa, aoConcluir, aoExcluir }: PropsItem) {
  const idTitulo = `tarefa-${tarefa.id}`;

  // O cache do TanStack Query notifica os componentes no tick seguinte. Sem um
  // estado local, o React devolveria o checkbox ao valor antigo logo após o
  // clique e só depois o marcaria, e a caixa piscaria. Quando o dado muda por
  // fora (resposta do servidor, erro que desfaz a mudança), o estado local
  // acompanha.
  const [concluida, setConcluida] = useState(tarefa.concluida);
  const [ultimaDoServidor, setUltimaDoServidor] = useState(tarefa.concluida);
  if (tarefa.concluida !== ultimaDoServidor) {
    setUltimaDoServidor(tarefa.concluida);
    setConcluida(tarefa.concluida);
  }

  function alternar(marcada: boolean) {
    setConcluida(marcada);
    aoConcluir(marcada);
  }
  return (
    <li
      data-testid="tarefa"
      data-concluida={concluida}
      className={`cartao flex items-start gap-4 border-l-4 p-4 ${
        concluida ? "border-l-turquesa" : "border-l-magenta"
      }`}
    >
      <label className="relative mt-0.5 flex size-6 shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={concluida}
          onChange={(e) => alternar(e.target.checked)}
          aria-labelledby={idTitulo}
          className="peer size-6 cursor-pointer appearance-none rounded-full border-2 border-grafite/50 transition-colors checked:border-turquesa checked:bg-turquesa hover:border-turquesa-escuro dark:border-white/40"
        />
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden size-6 p-1 text-marinho peer-checked:block"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </label>

      <div className="min-w-0 flex-1">
        <h2
          id={idTitulo}
          className={`font-medium break-words ${concluida ? "texto-suave line-through" : ""}`}
        >
          {tarefa.titulo}
        </h2>
        {tarefa.descricao && (
          <p className="texto-suave mt-1 text-sm whitespace-pre-line break-words">{tarefa.descricao}</p>
        )}
        <p className="texto-suave mt-2 text-xs">
          Criada em <time dateTime={tarefa.dataCriacao}>{formatarData(tarefa.dataCriacao)}</time>
          {concluida &&
            (tarefa.dataConclusao ? (
              <>
                {" · Concluída em "}
                <time dateTime={tarefa.dataConclusao}>{formatarData(tarefa.dataConclusao)}</time>
              </>
            ) : (
              " · Concluída"
            ))}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
        <Link href={`/tarefas/${tarefa.id}/editar`} aria-label={`Editar ${tarefa.titulo}`} className="link-acao text-center">
          Editar
        </Link>
        <button type="button" onClick={aoExcluir} aria-label={`Excluir ${tarefa.titulo}`} className="link-acao">
          Excluir
        </button>
      </div>
    </li>
  );
}

function Vazio() {
  return (
    <div className="rounded border border-dashed border-nevoa-borda py-12 text-center dark:border-marinho-borda">
      <p className="texto-suave">Nenhuma tarefa por aqui.</p>
      <Link href="/tarefas/nova" className="botao-primario mt-4">
        Criar a primeira
      </Link>
    </div>
  );
}

function Falha({ mensagem, aoTentarDeNovo }: { mensagem: string; aoTentarDeNovo: () => void }) {
  return (
    <div role="alert" className="rounded border-l-4 border-erro bg-erro-fundo p-6 text-center text-erro dark:bg-marinho-superficie dark:text-erro-claro">
      <p>Não foi possível carregar as tarefas: {mensagem}</p>
      <button type="button" onClick={aoTentarDeNovo} className="botao-secundario mt-3">
        Tentar de novo
      </button>
    </div>
  );
}

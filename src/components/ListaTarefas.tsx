"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTRPC } from "@/trpc/client";
import { TAMANHO_PAGINA } from "@/lib/constantes";
import { formatarData } from "@/lib/formatar";
import type { Tarefa } from "@/server/tarefas/schema";
import { useAvisos } from "./Avisos";
import { ConfirmarExclusao } from "./ConfirmarExclusao";

export function ListaTarefas() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const setAviso = useAvisos();
  const [paraExcluir, setParaExcluir] = useState<Tarefa | null>(null);

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

  // Mover também é otimista: a tarefa fica onde foi solta, e o servidor só
  // registra a posição. As páginas mantêm o tamanho que tinham, para o cursor
  // da próxima página continuar coerente.
  const mover = useMutation(
    trpc.tarefas.mover.mutationOptions({
      onMutate: async ({ id, depoisDe }) => {
        await queryClient.cancelQueries({ queryKey: chaveLista });
        const anterior = queryClient.getQueryData(chaveLista);
        queryClient.setQueryData(chaveLista, (dados) => {
          if (!dados) return dados;
          const todas = dados.pages.flatMap((p) => p.itens);
          const movida = todas.find((t) => t.id === id);
          if (!movida) return dados;
          const semEla = todas.filter((t) => t.id !== id);
          const destino = depoisDe === null ? 0 : semEla.findIndex((t) => t.id === depoisDe) + 1;
          semEla.splice(destino, 0, movida);
          let inicio = 0;
          return {
            ...dados,
            pages: dados.pages.map((p) => {
              const itens = semEla.slice(inicio, inicio + p.itens.length);
              inicio += p.itens.length;
              return { ...p, itens };
            }),
          };
        });
        return { anterior };
      },
      onError: (erro, _variaveis, resultado) => {
        if (resultado?.anterior) queryClient.setQueryData(chaveLista, resultado.anterior);
        setAviso({ tipo: "erro", mensagem: `Não foi possível mover: ${erro.message}` });
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: trpc.tarefas.listar.pathKey() }),
    }),
  );

  // Arrastar com mouse ou toque só começa depois de 5px de movimento, para um
  // clique simples no puxador não virar arraste. Pelo teclado: espaço pega,
  // setas movem, espaço solta, Esc cancela.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Id fixo: sem ele, o dnd-kit gera ids diferentes no servidor e no
  // navegador, e o React acusa erro de hidratação.
  const idArraste = useId();

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

  // Um mesmo id pode aparecer em duas páginas por um instante, logo depois de
  // um movimento e antes da lista ser recarregada. Vale a primeira ocorrência.
  const tarefas = deduplicar(lista.data?.pages.flatMap((p) => p.itens) ?? []);
  const titulos = new Map(tarefas.map((t) => [t.id, t.titulo]));

  function aoSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = tarefas.map((t) => t.id);
    const nova = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    const indice = nova.indexOf(String(active.id));
    mover.mutate({ id: String(active.id), depoisDe: nova[indice - 1] ?? null });
  }

  const anuncios = criarAnuncios(titulos, tarefas.length);

  return (
    <section aria-label="Lista de tarefas">
      {lista.isError && !lista.data ? (
        <Falha mensagem={lista.error.message} aoTentarDeNovo={() => void lista.refetch()} />
      ) : tarefas.length === 0 ? (
        <Vazio />
      ) : (
        <DndContext
          id={idArraste}
          sensors={sensores}
          collisionDetection={closestCenter}
          onDragEnd={aoSoltar}
          accessibility={{
            announcements: anuncios,
            screenReaderInstructions: {
              draggable:
                "Para mover a tarefa, pressione espaço. Use as setas para cima e para baixo, espaço de novo para soltar ou Esc para cancelar.",
            },
          }}
        >
          <SortableContext items={tarefas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
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
          </SortableContext>
        </DndContext>
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

function deduplicar(tarefas: Tarefa[]): Tarefa[] {
  const vistos = new Set<string>();
  return tarefas.filter((t) => !vistos.has(t.id) && vistos.add(t.id));
}

/** O que o leitor de tela anuncia durante o arraste, em português. */
function criarAnuncios(titulos: Map<string, string>, total: number): Announcements {
  const nome = (id: string | number) => titulos.get(String(id)) ?? "Tarefa";
  const ids = [...titulos.keys()];
  const lugar = (id: string | number) => `posição ${ids.indexOf(String(id)) + 1} de ${total}`;
  return {
    onDragStart: ({ active }) => `${nome(active.id)} selecionada, na ${lugar(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nome(active.id)} sobre a ${lugar(over.id)}.` : `${nome(active.id)} fora da lista.`,
    onDragEnd: ({ active, over }) =>
      over ? `${nome(active.id)} solta na ${lugar(over.id)}.` : `${nome(active.id)} solta fora da lista.`,
    onDragCancel: ({ active }) => `Movimento cancelado. ${nome(active.id)} voltou ao lugar.`,
  };
}

function ItemTarefa({ tarefa, aoConcluir, aoExcluir }: PropsItem) {
  const idTitulo = `tarefa-${tarefa.id}`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: tarefa.id, attributes: { roleDescription: "tarefa arrastável" } });

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
      ref={setNodeRef}
      // Só o eixo vertical: a tarefa não sai da coluna durante o arraste.
      style={{ transform: CSS.Transform.toString(transform && { ...transform, x: 0 }), transition }}
      data-testid="tarefa"
      data-concluida={concluida}
      className={`cartao relative flex items-start gap-3 border-l-4 p-4 ${
        concluida ? "border-l-turquesa" : "border-l-magenta"
      } ${isDragging ? "z-10 shadow-xl ring-2 ring-magenta/60" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Mover ${tarefa.titulo}`}
        className={`texto-suave -my-1 -ml-2 flex h-8 w-6 shrink-0 touch-none items-center justify-center rounded hover:bg-nevoa dark:hover:bg-marinho-borda ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <svg viewBox="0 0 10 16" aria-hidden="true" className="h-4 w-2.5 fill-current">
          <circle cx="2" cy="2" r="1.5" />
          <circle cx="8" cy="2" r="1.5" />
          <circle cx="2" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="2" cy="14" r="1.5" />
          <circle cx="8" cy="14" r="1.5" />
        </svg>
      </button>
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
        <Link href={`/tarefas/${tarefa.id}/editar?voltar=1`} aria-label={`Editar ${tarefa.titulo}`} className="link-acao text-center">
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

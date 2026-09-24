import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ListaTarefas } from "@/components/ListaTarefas";
import { TAMANHO_PAGINA } from "@/lib/constantes";
import { getQueryClient, trpc } from "@/trpc/server";

// A lista depende do cookie de cada visitante. Sem esta linha, o Next poderia
// tentar gerar a página uma vez só, no build.
export const dynamic = "force-dynamic";

const AVISOS = {
  criada: "Tarefa criada.",
  atualizada: "Tarefa atualizada.",
} as const;

type Props = { searchParams: Promise<{ aviso?: string }> };

export default async function PaginaListagem({ searchParams }: Props) {
  const { aviso } = await searchParams;

  // SSR: a primeira página é buscada aqui, no servidor, e vai no HTML. O
  // HydrationBoundary entrega o mesmo dado ao cache do cliente, que continua
  // a rolagem a partir dele sem repetir a busca.
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(
    trpc.tarefas.listar.infiniteQueryOptions(
      { limite: TAMANHO_PAGINA },
      { getNextPageParam: (pagina) => pagina.proximoCursor },
    ),
  );

  const mensagem = aviso && aviso in AVISOS ? AVISOS[aviso as keyof typeof AVISOS] : undefined;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ListaTarefas avisoInicial={mensagem} />
    </HydrationBoundary>
  );
}

import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { BoasVindas } from "@/components/BoasVindas";
import { ListaTarefas } from "@/components/ListaTarefas";
import { COOKIE_BOAS_VINDAS, TAMANHO_PAGINA } from "@/lib/constantes";
import { getQueryClient, trpc } from "@/trpc/server";

// A lista depende do cookie de cada visitante. Sem esta linha, o Next poderia
// tentar gerar a página uma vez só, no build.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ ajuda?: string }> };

export default async function PaginaListagem({ searchParams }: Props) {
  const { ajuda } = await searchParams;
  const jaViuBoasVindas = (await cookies()).has(COOKIE_BOAS_VINDAS);
  const veioDoMenu = ajuda === "1";

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

  return (
    <>
      {(!jaViuBoasVindas || veioDoMenu) && <BoasVindas veioDoMenu={veioDoMenu} />}
      <h1 className="titulo-pagina mb-6">Suas tarefas</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ListaTarefas />
      </HydrationBoundary>
    </>
  );
}

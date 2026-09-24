import { QueryClient } from "@tanstack/react-query";

export function criarQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Com o dado recém-chegado do SSR, o cliente não repete a busca ao
        // hidratar a página.
        staleTime: 30 * 1000,
        retry: 1,
      },
    },
  });
}

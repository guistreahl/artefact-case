import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With fresh data from the SSR, the client does not fetch again when
        // hydrating the page.
        staleTime: 30 * 1000,
        retry: 1,
      },
    },
  });
}

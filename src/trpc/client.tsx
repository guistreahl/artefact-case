"use client";

import { useState } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@/server/root";
import { criarQueryClient } from "./query-client";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let queryClientDoNavegador: QueryClient | undefined;

function getQueryClient() {
  // No servidor, um cliente novo por renderização. No navegador, um só para a
  // vida da página, senão o cache se perderia a cada renderização.
  if (typeof window === "undefined") return criarQueryClient();
  return (queryClientDoNavegador ??= criarQueryClient());
}

export function Provedores({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc" })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}

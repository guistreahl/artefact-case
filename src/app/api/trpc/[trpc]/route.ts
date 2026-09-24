import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/root";
import { contextoDaRequisicao } from "@/server/contexto";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => contextoDaRequisicao(req),
    onError({ path, error }) {
      // Erro 500 vai para o log (no Cloud Run, o Cloud Logging). Erros
      // esperados, como validação e NOT_FOUND, não poluem o log.
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(JSON.stringify({ severity: "ERROR", procedimento: path, mensagem: error.message }));
      }
    },
  });
}

export { handler as GET, handler as POST };

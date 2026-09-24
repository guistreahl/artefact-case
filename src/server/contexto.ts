import { COOKIE_SESSAO, type Contexto } from "./trpc";
import { repositorio } from "./tarefas/store";

/** Contexto para requisições HTTP em /api/trpc. */
export function contextoDaRequisicao(req: Request): Contexto {
  return { sessao: lerCookie(req.headers.get("cookie"), COOKIE_SESSAO), repositorio };
}

function lerCookie(cabecalho: string | null, nome: string): string | undefined {
  for (const par of cabecalho?.split(";") ?? []) {
    const [chave, ...valor] = par.trim().split("=");
    if (chave === nome) return decodeURIComponent(valor.join("="));
  }
  return undefined;
}

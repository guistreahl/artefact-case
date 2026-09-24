import { timingSafeEqual } from "node:crypto";

/** Cabeçalho que o Cloudflare acrescenta a toda requisição que passa por ele. */
export const CABECALHO_ORIGEM = "x-origem-cloudflare";

/**
 * Confere se a requisição passou pelo Cloudflare.
 *
 * Sem segredo configurado (desenvolvimento, testes, quem roda o projeto
 * localmente), tudo passa. Em produção, o segredo vem do Secret Manager, e só
 * o Cloudflare o conhece. Comparação em tempo constante, para o tempo de
 * resposta não revelar quantos caracteres estavam certos.
 */
export function origemAutorizada(recebido: string | null, segredo: string | undefined): boolean {
  if (!segredo) return true;
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(segredo);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Limite de requisições por chave numa janela deslizante.
 *
 * Funciona em memória porque o serviço roda numa instância só (a mesma
 * restrição que mantém a lista de tarefas coerente).
 */
export class LimitadorDeTaxa {
  private readonly registros = new Map<string, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly janelaMs: number,
    private readonly agora: () => number = () => Date.now(),
    private readonly maxChaves = 5000,
  ) {}

  /** Registra uma tentativa e diz se ela está dentro do limite. */
  permitir(chave: string): boolean {
    const agora = this.agora();
    const recentes = (this.registros.get(chave) ?? []).filter((t) => agora - t < this.janelaMs);
    if (recentes.length >= this.maximo) {
      this.registros.set(chave, recentes);
      return false;
    }
    recentes.push(agora);
    this.registros.delete(chave);
    this.registros.set(chave, recentes);
    // Muitas chaves diferentes (IPs variados): descarta as menos recentes.
    if (this.registros.size > this.maxChaves) {
      const maisAntiga = this.registros.keys().next().value;
      if (maisAntiga !== undefined) this.registros.delete(maisAntiga);
    }
    return true;
  }
}

/**
 * IP do visitante. Atrás do Cloudflare, ele vem em cf-connecting-ip; sem ele,
 * o primeiro endereço de x-forwarded-for, preenchido pelo Cloud Run.
 */
export function ipDaRequisicao(cabecalhos: Headers): string | undefined {
  return (
    cabecalhos.get("cf-connecting-ip") ??
    cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined
  );
}

// 60 alterações por minuto por visitante: folgado para uma pessoa, curto para
// um script.
const global = globalThis as typeof globalThis & { __limitadorAlteracoes?: LimitadorDeTaxa };
export const limitadorDeAlteracoes = (global.__limitadorAlteracoes ??= new LimitadorDeTaxa(60, 60_000));

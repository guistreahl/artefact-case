import type { DadosTarefa, Tarefa } from "./schema";
import { tarefasDeExemplo } from "./exemplos";

export const MAX_SESSOES = 500;
export const MAX_TAREFAS_POR_SESSAO = 200;

export class LimiteDeTarefasError extends Error {}

export type Pagina = {
  itens: Tarefa[];
  proximoCursor: string | null;
};

/**
 * Guarda as tarefas em memória, uma lista por sessão de visitante.
 *
 * Nada aqui sobrevive a um reinício do processo, e isso é intencional: o case
 * dispensa persistência. A separação por sessão existe porque a aplicação fica
 * num endereço público, e com uma lista única cada visitante veria o que os
 * anteriores escreveram.
 */
export class RepositorioTarefas {
  // Map preserva a ordem de inserção. Cada acesso reinsere a sessão no fim,
  // então a primeira chave é sempre a menos usada recentemente.
  private readonly sessoes = new Map<string, Map<string, Tarefa>>();

  constructor(private readonly agora: () => Date = () => new Date()) {}

  private lista(sessao: string): Map<string, Tarefa> {
    let tarefas = this.sessoes.get(sessao);
    if (tarefas) {
      this.sessoes.delete(sessao);
    } else {
      tarefas = new Map(tarefasDeExemplo(this.agora()).map((t) => [t.id, t]));
      if (this.sessoes.size >= MAX_SESSOES) {
        const maisAntiga = this.sessoes.keys().next().value;
        if (maisAntiga !== undefined) this.sessoes.delete(maisAntiga);
      }
    }
    this.sessoes.set(sessao, tarefas);
    return tarefas;
  }

  private ordenadas(sessao: string): Tarefa[] {
    return [...this.lista(sessao).values()].sort(compararPorPosicao);
  }

  /**
   * Paginação por cursor, na ordem manual da lista.
   *
   * O cursor carrega a posição e o id da última tarefa entregue, e não um
   * índice. Assim, excluir uma tarefa no meio da rolagem não faz a próxima
   * página pular um item, e o cursor continua válido mesmo que a própria
   * tarefa que o gerou tenha sido excluída.
   */
  listar(sessao: string, cursor: string | null | undefined, limite: number): Pagina {
    const ordenadas = this.ordenadas(sessao);
    const inicio = cursor ? ordenadas.filter((t) => compararComCursor(t, cursor) > 0) : ordenadas;
    const itens = inicio.slice(0, limite);
    const ultima = itens.at(-1);
    const temMais = inicio.length > limite;
    return { itens, proximoCursor: temMais && ultima ? criarCursor(ultima) : null };
  }

  obter(sessao: string, id: string): Tarefa | undefined {
    return this.lista(sessao).get(id);
  }

  criar(sessao: string, dados: DadosTarefa): Tarefa {
    const tarefas = this.lista(sessao);
    if (tarefas.size >= MAX_TAREFAS_POR_SESSAO) {
      throw new LimiteDeTarefasError(
        `Limite de ${MAX_TAREFAS_POR_SESSAO} tarefas atingido. Exclua alguma para criar outra.`,
      );
    }
    // Tarefa nova entra no topo: uma posição antes da primeira.
    const primeira = this.ordenadas(sessao)[0];
    const tarefa: Tarefa = {
      id: crypto.randomUUID(),
      titulo: dados.titulo,
      descricao: dados.descricao,
      concluida: false,
      dataCriacao: this.agora().toISOString(),
      posicao: primeira ? primeira.posicao - 1 : 0,
    };
    tarefas.set(tarefa.id, tarefa);
    return tarefa;
  }

  atualizar(sessao: string, id: string, dados: DadosTarefa): Tarefa | undefined {
    const tarefas = this.lista(sessao);
    const atual = tarefas.get(id);
    if (!atual) return undefined;
    // id, datas e conclusão não mudam pelo formulário de edição.
    const atualizada: Tarefa = { ...atual, titulo: dados.titulo, descricao: dados.descricao };
    tarefas.set(id, atualizada);
    return atualizada;
  }

  definirConclusao(sessao: string, id: string, concluida: boolean): Tarefa | undefined {
    const tarefas = this.lista(sessao);
    const atual = tarefas.get(id);
    if (!atual) return undefined;
    // Marcar de novo uma tarefa já concluída não muda o horário registrado.
    if (atual.concluida === concluida) return atual;
    const atualizada: Tarefa = {
      ...atual,
      concluida,
      dataConclusao: concluida ? this.agora().toISOString() : undefined,
    };
    tarefas.set(id, atualizada);
    return atualizada;
  }

  /**
   * Coloca a tarefa logo abaixo de `depoisDe`, ou no topo com null.
   *
   * A posição nova é o ponto médio entre as duas vizinhas, então só a tarefa
   * movida muda. Quando as vizinhas ficam próximas demais para caber um número
   * entre elas, a lista inteira é renumerada.
   */
  mover(sessao: string, id: string, depoisDe: string | null): Tarefa | undefined {
    const tarefas = this.lista(sessao);
    const movida = tarefas.get(id);
    if (!movida) return undefined;
    if (depoisDe !== null && (depoisDe === id || !tarefas.has(depoisDe))) return undefined;

    let restantes = this.ordenadas(sessao).filter((t) => t.id !== id);
    let posicao = calcularPosicao(restantes, depoisDe);
    if (posicao === undefined) {
      restantes.forEach((t, i) => tarefas.set(t.id, { ...t, posicao: i }));
      restantes = this.ordenadas(sessao).filter((t) => t.id !== id);
      posicao = calcularPosicao(restantes, depoisDe) as number;
    }

    const atualizada: Tarefa = { ...movida, posicao };
    tarefas.set(id, atualizada);
    return atualizada;
  }

  remover(sessao: string, id: string): boolean {
    return this.lista(sessao).delete(id);
  }
}

/** Menor espaço aceito entre duas posições antes de renumerar a lista. */
const ESPACO_MINIMO = 1e-9;

/** Posição logo abaixo de `depoisDe`, ou undefined se não houver espaço. */
function calcularPosicao(ordenadas: Tarefa[], depoisDe: string | null): number | undefined {
  const indice = depoisDe === null ? -1 : ordenadas.findIndex((t) => t.id === depoisDe);
  const acima = ordenadas[indice];
  const abaixo = ordenadas[indice + 1];
  if (!acima) return abaixo ? abaixo.posicao - 1 : 0;
  if (!abaixo) return acima.posicao + 1;
  if (abaixo.posicao - acima.posicao < ESPACO_MINIMO) return undefined;
  return (acima.posicao + abaixo.posicao) / 2;
}

function compararPorPosicao(a: Pick<Tarefa, "posicao" | "id">, b: Pick<Tarefa, "posicao" | "id">): number {
  if (a.posicao !== b.posicao) return a.posicao - b.posicao;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Nem o número nem o UUID contêm "_", então ele separa as duas partes sem
// ambiguidade.
function criarCursor(tarefa: Tarefa): string {
  return `${tarefa.posicao}_${tarefa.id}`;
}

/** Positivo quando a tarefa vem depois do cursor na ordem da lista. */
function compararComCursor(tarefa: Tarefa, cursor: string): number {
  const separador = cursor.indexOf("_");
  const posicao = Number(cursor.slice(0, separador));
  const id = cursor.slice(separador + 1);
  return compararPorPosicao(tarefa, { posicao, id });
}

// Uma única instância por processo. Guardada em globalThis porque o `next dev`
// recarrega os módulos a cada alteração, e sem isso a lista zeraria a cada
// arquivo salvo.
const global = globalThis as typeof globalThis & { __repositorioTarefas?: RepositorioTarefas };
export const repositorio = (global.__repositorioTarefas ??= new RepositorioTarefas());

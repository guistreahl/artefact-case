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

  /**
   * Paginação por cursor, da tarefa mais nova para a mais antiga.
   *
   * O cursor carrega a posição (data e id) da última tarefa entregue, e não um
   * índice. Assim, excluir uma tarefa no meio da rolagem não faz a próxima
   * página pular um item, e o cursor continua válido mesmo que a própria
   * tarefa que o gerou tenha sido excluída.
   */
  listar(sessao: string, cursor: string | null | undefined, limite: number): Pagina {
    const ordenadas = [...this.lista(sessao).values()].sort(compararMaisNovaPrimeiro);
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
    const tarefa: Tarefa = {
      id: crypto.randomUUID(),
      titulo: dados.titulo,
      descricao: dados.descricao,
      concluida: false,
      dataCriacao: this.agora().toISOString(),
    };
    tarefas.set(tarefa.id, tarefa);
    return tarefa;
  }

  atualizar(sessao: string, id: string, dados: DadosTarefa): Tarefa | undefined {
    const tarefas = this.lista(sessao);
    const atual = tarefas.get(id);
    if (!atual) return undefined;
    // id, dataCriacao e concluida não mudam pelo formulário de edição.
    const atualizada: Tarefa = { ...atual, titulo: dados.titulo, descricao: dados.descricao };
    tarefas.set(id, atualizada);
    return atualizada;
  }

  definirConclusao(sessao: string, id: string, concluida: boolean): Tarefa | undefined {
    const tarefas = this.lista(sessao);
    const atual = tarefas.get(id);
    if (!atual) return undefined;
    const atualizada: Tarefa = { ...atual, concluida };
    tarefas.set(id, atualizada);
    return atualizada;
  }

  remover(sessao: string, id: string): boolean {
    return this.lista(sessao).delete(id);
  }
}

function compararMaisNovaPrimeiro(a: Tarefa, b: Tarefa): number {
  if (a.dataCriacao !== b.dataCriacao) return a.dataCriacao < b.dataCriacao ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

// O ISO 8601 não contém "_", então ele separa as duas partes sem ambiguidade.
function criarCursor(tarefa: Tarefa): string {
  return `${tarefa.dataCriacao}_${tarefa.id}`;
}

/** Positivo quando a tarefa vem depois do cursor na ordem da lista. */
function compararComCursor(tarefa: Tarefa, cursor: string): number {
  const separador = cursor.indexOf("_");
  const dataCriacao = cursor.slice(0, separador);
  const id = cursor.slice(separador + 1);
  return compararMaisNovaPrimeiro(tarefa, { id, dataCriacao, titulo: "", concluida: false });
}

// Uma única instância por processo. Guardada em globalThis porque o `next dev`
// recarrega os módulos a cada alteração, e sem isso a lista zeraria a cada
// arquivo salvo.
const global = globalThis as typeof globalThis & { __repositorioTarefas?: RepositorioTarefas };
export const repositorio = (global.__repositorioTarefas ??= new RepositorioTarefas());

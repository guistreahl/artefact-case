import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { createCaller } from "../root";
import { MAX_SESSOES, MAX_TAREFAS_POR_SESSAO, RepositorioTarefas } from "./store";

const TOTAL_EXEMPLOS = 30;

let repositorio: RepositorioTarefas;
const caller = (sessao = "sessao-a") => createCaller({ sessao, repositorio });

async function codigoDoErro(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa;
  } catch (erro) {
    if (erro instanceof TRPCError) return erro.code;
    throw erro;
  }
  throw new Error("era esperado um erro");
}

beforeEach(() => {
  repositorio = new RepositorioTarefas();
});

describe("criar", () => {
  it("gera id e dataCriacao no servidor e guarda a tarefa", async () => {
    const tarefa = await caller().tarefas.criar({ titulo: "  Estudar tRPC  ", descricao: "Ler a documentação" });

    expect(tarefa.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(tarefa.dataCriacao)).not.toBeNaN();
    expect(tarefa.titulo).toBe("Estudar tRPC");
    await expect(caller().tarefas.obter({ id: tarefa.id })).resolves.toEqual(tarefa);
  });

  it("recusa título vazio ou só com espaços", async () => {
    expect(await codigoDoErro(caller().tarefas.criar({ titulo: "" }))).toBe("BAD_REQUEST");
    expect(await codigoDoErro(caller().tarefas.criar({ titulo: "   " }))).toBe("BAD_REQUEST");
  });

  it("trata descrição em branco como ausente", async () => {
    const tarefa = await caller().tarefas.criar({ titulo: "Sem descrição", descricao: "   " });
    expect(tarefa.descricao).toBeUndefined();
  });

  it("recusa a tarefa que passaria do limite da sessão", async () => {
    for (let i = TOTAL_EXEMPLOS; i < MAX_TAREFAS_POR_SESSAO; i++) {
      await caller().tarefas.criar({ titulo: `Tarefa ${i}` });
    }
    expect(await codigoDoErro(caller().tarefas.criar({ titulo: "Uma a mais" }))).toBe("TOO_MANY_REQUESTS");
  });
});

describe("atualizar", () => {
  it("altera título e descrição, e preserva id e dataCriacao", async () => {
    const original = await caller().tarefas.criar({ titulo: "Antes", descricao: "Descrição antiga" });
    const atualizada = await caller().tarefas.atualizar({ id: original.id, titulo: "Depois" });

    expect(atualizada).toEqual({ ...original, titulo: "Depois", descricao: undefined });
  });

  it("devolve NOT_FOUND para tarefa inexistente", async () => {
    expect(await codigoDoErro(caller().tarefas.atualizar({ id: "nao-existe", titulo: "X" }))).toBe("NOT_FOUND");
  });

  it("recusa título vazio", async () => {
    const tarefa = await caller().tarefas.criar({ titulo: "Válida" });
    expect(await codigoDoErro(caller().tarefas.atualizar({ id: tarefa.id, titulo: "" }))).toBe("BAD_REQUEST");
  });
});

describe("concluir", () => {
  it("registra o horário da conclusão e o apaga ao reabrir", async () => {
    let agora = new Date("2026-09-24T12:00:00.000Z");
    repositorio = new RepositorioTarefas(() => agora);
    const tarefa = await caller().tarefas.criar({ titulo: "Concluir" });
    expect(tarefa.concluida).toBe(false);
    expect(tarefa.dataConclusao).toBeUndefined();

    agora = new Date("2026-09-24T15:30:00.000Z");
    const concluida = await caller().tarefas.concluir({ id: tarefa.id, concluida: true });
    expect(concluida).toEqual({ ...tarefa, concluida: true, dataConclusao: "2026-09-24T15:30:00.000Z" });

    const reaberta = await caller().tarefas.concluir({ id: tarefa.id, concluida: false });
    expect(reaberta.concluida).toBe(false);
    expect(reaberta.dataConclusao).toBeUndefined();
  });

  it("concluir de novo uma tarefa concluída mantém o horário original", async () => {
    let agora = new Date("2026-09-24T12:00:00.000Z");
    repositorio = new RepositorioTarefas(() => agora);
    const tarefa = await caller().tarefas.criar({ titulo: "Uma vez só" });
    await caller().tarefas.concluir({ id: tarefa.id, concluida: true });

    agora = new Date("2026-09-24T18:00:00.000Z");
    const denovo = await caller().tarefas.concluir({ id: tarefa.id, concluida: true });
    expect(denovo.dataConclusao).toBe("2026-09-24T12:00:00.000Z");
  });

  it("editar pelo formulário preserva a conclusão", async () => {
    const tarefa = await caller().tarefas.criar({ titulo: "Antes" });
    await caller().tarefas.concluir({ id: tarefa.id, concluida: true });
    const editada = await caller().tarefas.atualizar({ id: tarefa.id, titulo: "Depois" });
    expect(editada.concluida).toBe(true);
    expect(editada.dataConclusao).toBeDefined();
  });

  it("devolve NOT_FOUND para tarefa inexistente", async () => {
    expect(await codigoDoErro(caller().tarefas.concluir({ id: "nao-existe", concluida: true }))).toBe("NOT_FOUND");
  });
});

describe("remover", () => {
  it("remove a tarefa e depois devolve NOT_FOUND", async () => {
    const tarefa = await caller().tarefas.criar({ titulo: "Remover" });

    await expect(caller().tarefas.remover({ id: tarefa.id })).resolves.toEqual({ id: tarefa.id });
    expect(await codigoDoErro(caller().tarefas.obter({ id: tarefa.id }))).toBe("NOT_FOUND");
    expect(await codigoDoErro(caller().tarefas.remover({ id: tarefa.id }))).toBe("NOT_FOUND");
  });
});

describe("listar", () => {
  it("começa com as tarefas de exemplo, da mais nova para a mais antiga", async () => {
    const { itens } = await caller().tarefas.listar({ limite: 50 });

    expect(itens).toHaveLength(TOTAL_EXEMPLOS);
    const datas = itens.map((t) => t.dataCriacao);
    expect(datas).toEqual([...datas].sort().reverse());
  });

  it("coloca a tarefa recém-criada no topo", async () => {
    const tarefa = await caller().tarefas.criar({ titulo: "Nova" });
    const { itens } = await caller().tarefas.listar({ limite: 1 });
    expect(itens[0]?.id).toBe(tarefa.id);
  });

  it("percorre todas as páginas pelo cursor, sem repetir nem pular", async () => {
    const vistos: string[] = [];
    let cursor: string | null = null;
    do {
      const pagina: Awaited<ReturnType<ReturnType<typeof caller>["tarefas"]["listar"]>> =
        await caller().tarefas.listar({ cursor, limite: 7 });
      vistos.push(...pagina.itens.map((t) => t.id));
      cursor = pagina.proximoCursor;
    } while (cursor);

    expect(vistos).toHaveLength(TOTAL_EXEMPLOS);
    expect(new Set(vistos).size).toBe(TOTAL_EXEMPLOS);
  });

  it("não pula item quando a última tarefa da página é excluída antes da próxima", async () => {
    const primeira = await caller().tarefas.listar({ limite: 10 });
    const esperada = (await caller().tarefas.listar({ limite: 11 })).itens[10];

    await caller().tarefas.remover({ id: primeira.itens[9]!.id });
    const segunda = await caller().tarefas.listar({ cursor: primeira.proximoCursor, limite: 10 });

    expect(segunda.itens[0]?.id).toBe(esperada?.id);
  });

  it("devolve proximoCursor nulo na última página", async () => {
    const pagina = await caller().tarefas.listar({ limite: TOTAL_EXEMPLOS });
    expect(pagina.proximoCursor).toBeNull();
  });
});

describe("sessões", () => {
  it("isola as listas de visitantes diferentes", async () => {
    const tarefa = await caller("sessao-a").tarefas.criar({ titulo: "Só da sessão A" });

    expect(await codigoDoErro(caller("sessao-b").tarefas.obter({ id: tarefa.id }))).toBe("NOT_FOUND");
    expect(await codigoDoErro(caller("sessao-b").tarefas.remover({ id: tarefa.id }))).toBe("NOT_FOUND");
  });

  it("recusa chamada sem sessão", async () => {
    const semSessao = createCaller({ sessao: undefined, repositorio });
    expect(await codigoDoErro(semSessao.tarefas.listar({}))).toBe("UNAUTHORIZED");
  });

  it("descarta a sessão menos usada ao passar do limite", async () => {
    const tarefa = await caller("primeira").tarefas.criar({ titulo: "Vai sumir" });
    for (let i = 0; i < MAX_SESSOES; i++) {
      await caller(`outra-${i}`).tarefas.listar({ limite: 1 });
    }
    expect(await codigoDoErro(caller("primeira").tarefas.obter({ id: tarefa.id }))).toBe("NOT_FOUND");
  });
});

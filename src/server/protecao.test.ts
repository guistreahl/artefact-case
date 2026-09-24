import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { createCaller } from "./root";
import { ipDaRequisicao, LimitadorDeTaxa, origemAutorizada } from "./protecao";
import { RepositorioTarefas } from "./tarefas/store";

describe("origemAutorizada", () => {
  it("sem segredo configurado, deixa tudo passar (desenvolvimento e testes)", () => {
    expect(origemAutorizada(null, undefined)).toBe(true);
    expect(origemAutorizada("qualquer", "")).toBe(true);
  });

  it("com segredo, exige o valor exato", () => {
    expect(origemAutorizada("segredo-certo", "segredo-certo")).toBe(true);
    expect(origemAutorizada(null, "segredo-certo")).toBe(false);
    expect(origemAutorizada("segredo-errad", "segredo-certo")).toBe(false);
    expect(origemAutorizada("segredo-certo-e-mais", "segredo-certo")).toBe(false);
  });
});

describe("LimitadorDeTaxa", () => {
  it("permite até o máximo na janela e libera quando ela passa", () => {
    let agora = 0;
    const limitador = new LimitadorDeTaxa(3, 1000, () => agora);

    expect([1, 2, 3].map(() => limitador.permitir("ip-a"))).toEqual([true, true, true]);
    expect(limitador.permitir("ip-a")).toBe(false);
    expect(limitador.permitir("ip-b")).toBe(true);

    agora = 1000;
    expect(limitador.permitir("ip-a")).toBe(true);
  });
});

describe("ipDaRequisicao", () => {
  it("prefere o IP informado pelo Cloudflare", () => {
    const cabecalhos = new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" });
    expect(ipDaRequisicao(cabecalhos)).toBe("203.0.113.7");
  });

  it("sem Cloudflare, usa o primeiro endereço de x-forwarded-for", () => {
    expect(ipDaRequisicao(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
    expect(ipDaRequisicao(new Headers())).toBeUndefined();
  });
});

describe("limite de alterações nos procedimentos", () => {
  it("recusa com TOO_MANY_REQUESTS depois do limite, e leituras continuam liberadas", async () => {
    const caller = createCaller({
      sessao: "sessao-a",
      ip: "203.0.113.7",
      repositorio: new RepositorioTarefas(),
      limitador: new LimitadorDeTaxa(2, 60_000),
    });

    await caller.tarefas.criar({ titulo: "Um" });
    await caller.tarefas.criar({ titulo: "Dois" });
    const erro = await caller.tarefas.criar({ titulo: "Três" }).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(TRPCError);
    expect((erro as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    await expect(caller.tarefas.listar({ limite: 1 })).resolves.toBeDefined();
  });
});

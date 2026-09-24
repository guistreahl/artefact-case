"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { z } from "zod";
import { useTRPC } from "@/trpc/client";
import { useAvisos } from "./Avisos";
import type { AppRouter } from "@/server/root";
import {
  dadosTarefaSchema,
  LIMITE_DESCRICAO,
  LIMITE_TITULO,
  type Tarefa,
} from "@/server/tarefas/schema";

type Campos = { titulo: string; descricao: string };
type ErrosCampos = Partial<Record<keyof Campos, string>>;

/** Valida com o mesmo schema do servidor. Devolve só a primeira mensagem de cada campo. */
function validar(campos: Campos): ErrosCampos {
  const resultado = dadosTarefaSchema.safeParse(campos);
  if (resultado.success) return {};
  const { fieldErrors } = z.flattenError(resultado.error);
  return { titulo: fieldErrors.titulo?.[0], descricao: fieldErrors.descricao?.[0] };
}

type Props = {
  /** Sem tarefa, o formulário cria. Com tarefa, edita. */
  tarefa?: Tarefa;
  /**
   * Veio da listagem. Ao salvar ou cancelar, volta pelo histórico em vez de
   * abrir a lista de novo, e o navegador devolve a rolagem ao ponto de onde a
   * pessoa saiu, com a tarefa editada à vista.
   */
  voltarAoTerminar?: boolean;
};

export function FormTarefa({ tarefa, voltarAoTerminar = false }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const mostrarAviso = useAvisos();
  const editando = tarefa !== undefined;

  const [campos, setCampos] = useState<Campos>({
    titulo: tarefa?.titulo ?? "",
    descricao: tarefa?.descricao ?? "",
  });
  const [erros, setErros] = useState<ErrosCampos>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  // Antes da primeira tentativa de envio, não há erro na tela: acusar
  // "informe um título" enquanto a pessoa ainda nem começou a digitar é ruído.
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const campoTitulo = useRef<HTMLInputElement>(null);

  const criar = useMutation(trpc.tarefas.criar.mutationOptions());
  const atualizar = useMutation(trpc.tarefas.atualizar.mutationOptions());
  const enviando = criar.isPending || atualizar.isPending || concluido;

  function alterar(campo: keyof Campos, valor: string) {
    const novos = { ...campos, [campo]: valor };
    setCampos(novos);
    if (tentouEnviar) setErros(validar(novos));
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setTentouEnviar(true);
    setErroGeral(null);

    const errosLocais = validar(campos);
    setErros(errosLocais);
    if (errosLocais.titulo || errosLocais.descricao) {
      campoTitulo.current?.focus();
      return;
    }

    try {
      if (editando) {
        const atualizada = await atualizar.mutateAsync({ id: tarefa.id, ...campos });
        // Grava a versão nova no cache da lista antes de voltar, para a
        // tarefa não aparecer por um instante com o texto antigo.
        queryClient.setQueriesData({ queryKey: trpc.tarefas.listar.pathKey() }, (dados) =>
          substituirNaLista(dados, atualizada),
        );
      } else {
        await criar.mutateAsync(campos);
      }
      setConcluido(true);
      void queryClient.invalidateQueries({ queryKey: trpc.tarefas.listar.pathKey() });
      mostrarAviso({ tipo: "sucesso", mensagem: editando ? "Tarefa atualizada." : "Tarefa criada." });
      sair();
    } catch (erro) {
      tratarErroDoServidor(erro);
    }
  }

  // Uma tarefa nova entra no topo da lista, então criar sempre abre a lista
  // do começo. Editar volta para onde a pessoa estava.
  function sair() {
    if (voltarAoTerminar) router.back();
    else router.push("/");
  }

  function tratarErroDoServidor(erro: unknown) {
    if (!(erro instanceof TRPCClientError)) {
      setErroGeral("Erro inesperado. Tente de novo.");
      return;
    }
    const { data } = erro as TRPCClientError<AppRouter>;
    if (!data) {
      // Sem resposta do servidor: a requisição nem chegou lá.
      setErroGeral("Sem conexão com o servidor. Verifique a internet e tente de novo.");
    } else if (data.erroValidacao) {
      const campos = data.erroValidacao.fieldErrors as Record<string, string[] | undefined>;
      setErros({ titulo: campos.titulo?.[0], descricao: campos.descricao?.[0] });
    } else if (data.code === "NOT_FOUND") {
      setErroGeral("Esta tarefa não existe mais. Ela pode ter sido excluída em outra aba.");
    } else {
      setErroGeral(erro.message);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="cartao space-y-5 p-6 sm:p-8" aria-busy={enviando}>
      <h1 className="titulo-pagina">{editando ? "Editar tarefa" : "Nova tarefa"}</h1>

      {erroGeral && (
        <p role="alert" className="rounded border-l-4 border-erro bg-erro-fundo px-4 py-3 text-sm text-erro dark:border-erro-claro dark:bg-marinho-superficie dark:text-erro-claro">
          {erroGeral}
        </p>
      )}

      <Campo
        id="titulo"
        rotulo="Título"
        obrigatorio
        erro={erros.titulo}
        contador={`${campos.titulo.length}/${LIMITE_TITULO}`}
      >
        {(props) => (
          <input
            {...props}
            ref={campoTitulo}
            type="text"
            value={campos.titulo}
            onChange={(e) => alterar("titulo", e.target.value)}
            maxLength={LIMITE_TITULO}
            autoFocus={!editando}
            autoComplete="off"
          />
        )}
      </Campo>

      <Campo
        id="descricao"
        rotulo="Descrição"
        erro={erros.descricao}
        contador={`${campos.descricao.length}/${LIMITE_DESCRICAO}`}
      >
        {(props) => (
          <textarea
            {...props}
            rows={5}
            value={campos.descricao}
            onChange={(e) => alterar("descricao", e.target.value)}
            maxLength={LIMITE_DESCRICAO}
          />
        )}
      </Campo>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="botao-primario"
        >
          {enviando ? "Salvando..." : editando ? "Salvar alterações" : "Criar tarefa"}
        </button>
        {voltarAoTerminar ? (
          <button type="button" onClick={() => router.back()} className="botao-secundario">
            Cancelar
          </button>
        ) : (
          <Link href="/" className="botao-secundario">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}

type PaginasDaLista = { pages: Array<{ itens: Tarefa[] }> };

function substituirNaLista(dados: unknown, tarefa: Tarefa): unknown {
  const lista = dados as PaginasDaLista | undefined;
  if (!lista?.pages) return dados;
  return {
    ...lista,
    pages: lista.pages.map((p) => ({ ...p, itens: p.itens.map((t) => (t.id === tarefa.id ? tarefa : t)) })),
  };
}

type PropsControle = {
  id: string;
  name: string;
  required?: boolean;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
  className: string;
};

type PropsCampo = {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  erro?: string;
  contador: string;
  children: (props: PropsControle) => React.ReactNode;
};

/** Rótulo, controle e mensagem de erro ligados por id, para leitores de tela. */
function Campo({ id, rotulo, obrigatorio, erro, contador, children }: PropsCampo) {
  const idErro = `${id}-erro`;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {rotulo}
          {obrigatorio && <span className="text-magenta-forte dark:text-magenta-claro"> *</span>}
        </label>
        <span className="texto-suave text-xs">{contador}</span>
      </div>
      {children({
        id,
        name: id,
        required: obrigatorio,
        "aria-invalid": Boolean(erro),
        "aria-describedby": erro ? idErro : undefined,
        className: "campo",
      })}
      {erro && (
        <p id={idErro} className="mt-1 text-sm text-erro dark:text-erro-claro">
          {erro}
        </p>
      )}
    </div>
  );
}

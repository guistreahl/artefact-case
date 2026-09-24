"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { z } from "zod";
import { useTRPC } from "@/trpc/client";
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
};

export function FormTarefa({ tarefa }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
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
        await atualizar.mutateAsync({ id: tarefa.id, ...campos });
      } else {
        await criar.mutateAsync(campos);
      }
      setConcluido(true);
      await queryClient.invalidateQueries({ queryKey: trpc.tarefas.listar.pathKey() });
      router.push(`/?aviso=${editando ? "atualizada" : "criada"}`);
    } catch (erro) {
      tratarErroDoServidor(erro);
    }
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
    <form onSubmit={enviar} noValidate className="space-y-5" aria-busy={enviando}>
      <h1 className="text-xl font-semibold">{editando ? "Editar tarefa" : "Nova tarefa"}</h1>

      {erroGeral && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
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
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? "Salvando..." : editando ? "Salvar alterações" : "Criar tarefa"}
        </button>
        <Link href="/" className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Cancelar
        </Link>
      </div>
    </form>
  );
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
          {obrigatorio && <span className="text-red-600"> *</span>}
        </label>
        <span className="text-xs text-slate-500">{contador}</span>
      </div>
      {children({
        id,
        name: id,
        required: obrigatorio,
        "aria-invalid": Boolean(erro),
        "aria-describedby": erro ? idErro : undefined,
        className: `block w-full rounded-md border bg-white px-3 py-2 shadow-sm focus:outline-2 focus:outline-indigo-600 dark:bg-slate-900 ${
          erro ? "border-red-500" : "border-slate-300 dark:border-slate-700"
        }`,
      })}
      {erro && (
        <p id={idErro} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
    </div>
  );
}

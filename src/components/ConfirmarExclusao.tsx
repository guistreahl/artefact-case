"use client";

import { useEffect, useRef } from "react";
import type { Tarefa } from "@/server/tarefas/schema";

type Props = {
  /** A tarefa a confirmar. Com null, o diálogo fica fechado. */
  tarefa: Tarefa | null;
  aoConfirmar: (tarefa: Tarefa) => void;
  aoFechar: () => void;
};

/**
 * Pede confirmação antes de excluir.
 *
 * Usa o <dialog> nativo com showModal(): o navegador já prende o foco dentro
 * dele, fecha com Esc, deixa o resto da página inerte e devolve o foco ao
 * botão que o abriu. O foco começa em Cancelar, a opção que não destrói nada.
 */
export function ConfirmarExclusao({ tarefa, aoConfirmar, aoFechar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (tarefa && !elemento.open) elemento.showModal();
    if (!tarefa && elemento.open) elemento.close();
  }, [tarefa]);

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      aria-labelledby="confirmar-exclusao-titulo"
      aria-describedby="confirmar-exclusao-texto"
      className="cartao m-auto w-[calc(100%-2rem)] max-w-md p-6 text-marinho backdrop:bg-marinho/60 dark:text-white"
    >
      <h2 id="confirmar-exclusao-titulo" className="text-xl font-light tracking-tight">
        Você deseja excluir esta tarefa?
      </h2>
      <p id="confirmar-exclusao-texto" className="texto-suave mt-3 text-sm">
        <strong className="font-medium text-marinho dark:text-white">{tarefa?.titulo}</strong> será
        removida da lista. Esta ação não pode ser desfeita.
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={aoFechar} className="botao-secundario">
          Cancelar
        </button>
        <button type="button" onClick={() => tarefa && aoConfirmar(tarefa)} className="botao-perigo">
          Excluir
        </button>
      </div>
    </dialog>
  );
}

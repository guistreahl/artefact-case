"use client";

import { useEffect } from "react";

export type DadosAviso = { tipo: "sucesso" | "erro"; mensagem: string };

const ESTILOS = {
  sucesso:
    "border-turquesa-escuro bg-turquesa-fundo text-marinho dark:border-turquesa dark:bg-marinho-superficie dark:text-white",
  erro: "border-erro bg-erro-fundo text-erro dark:border-erro-claro dark:bg-marinho-superficie dark:text-erro-claro",
};

type Props = { aviso: DadosAviso | null; aoFechar: () => void };

/**
 * Mensagem de retorno de uma ação. Sucesso some sozinho depois de alguns
 * segundos; erro fica até a pessoa fechar, para não sumir antes de ser lido.
 */
export function Aviso({ aviso, aoFechar }: Props) {
  useEffect(() => {
    if (aviso?.tipo !== "sucesso") return;
    const temporizador = setTimeout(aoFechar, 4000);
    return () => clearTimeout(temporizador);
  }, [aviso, aoFechar]);

  // A região aria-live existe sempre, mesmo vazia: leitores de tela só
  // anunciam mudanças em regiões que já estavam na página.
  return (
    <div aria-live="polite" className="empty:hidden">
      {aviso && (
        <div
          role={aviso.tipo === "erro" ? "alert" : "status"}
          className={`mb-4 flex items-start justify-between gap-4 rounded border-l-4 px-4 py-3 text-sm ${ESTILOS[aviso.tipo]}`}
        >
          <span>{aviso.mensagem}</span>
          <button type="button" onClick={aoFechar} aria-label="Fechar aviso" className="font-medium opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

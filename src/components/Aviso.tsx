"use client";

import { useEffect } from "react";

export type DadosAviso = { tipo: "sucesso" | "erro"; mensagem: string };

const ESTILOS = {
  sucesso:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  erro: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
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
          className={`mb-4 flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${ESTILOS[aviso.tipo]}`}
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

"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type DadosAviso = { tipo: "sucesso" | "erro"; mensagem: string };
type AvisoNaTela = DadosAviso & { id: number };

const ContextoAvisos = createContext<(aviso: DadosAviso) => void>(() => {});

/** Mostra um aviso flutuante no alto da janela, de qualquer componente. */
export const useAvisos = () => useContext(ContextoAvisos);

const ESTILOS = {
  sucesso: "border-turquesa-escuro dark:border-turquesa",
  erro: "border-erro dark:border-erro-claro",
};

const ICONES = {
  sucesso: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  erro: <path d="M12 7v6M12 17h.01" />,
};

/**
 * Avisos fixos no alto da janela, visíveis em qualquer ponto da rolagem.
 *
 * Fica no layout, acima das páginas, então um aviso disparado pelo formulário
 * continua na tela depois que a navegação volta para a lista. Um aviso novo
 * substitui o anterior.
 */
export function ProvedorAvisos({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = useState<AvisoNaTela | null>(null);
  const contador = useRef(0);

  const mostrar = useCallback((novo: DadosAviso) => {
    setAviso({ ...novo, id: ++contador.current });
  }, []);
  const fechar = useCallback(() => setAviso(null), []);

  // Sucesso some sozinho. Erro fica até a pessoa fechar, para não sumir antes
  // de ser lido.
  useEffect(() => {
    if (aviso?.tipo !== "sucesso") return;
    const temporizador = setTimeout(fechar, 4000);
    return () => clearTimeout(temporizador);
  }, [aviso, fechar]);

  return (
    <ContextoAvisos.Provider value={mostrar}>
      {children}
      {/* A região aria-live existe sempre, mesmo vazia: leitores de tela só
          anunciam mudanças em regiões que já estavam na página. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4"
      >
        {aviso && (
          <div
            key={aviso.id}
            role={aviso.tipo === "erro" ? "alert" : "status"}
            className={`cartao pointer-events-auto flex w-full max-w-md animate-surgir items-center gap-3 border-l-4 px-4 py-3 text-sm shadow-lg motion-reduce:animate-none ${ESTILOS[aviso.tipo]}`}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`size-5 shrink-0 fill-none stroke-current stroke-[2.5] ${
                aviso.tipo === "sucesso" ? "text-turquesa-escuro" : "text-erro dark:text-erro-claro"
              }`}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {ICONES[aviso.tipo]}
            </svg>
            <span className="flex-1">{aviso.mensagem}</span>
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar aviso"
              className="texto-suave rounded px-1 hover:text-marinho dark:hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </ContextoAvisos.Provider>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COOKIE_BOAS_VINDAS } from "@/lib/constantes";

const PASSOS = [
  { nome: "Conclua", texto: "Marque o círculo ao lado de uma tarefa. Clique de novo para reabrir." },
  { nome: "Crie", texto: "O botão Nova tarefa, no alto, abre o formulário. Título é obrigatório." },
  { nome: "Edite", texto: "Cada tarefa tem um botão Editar, que abre o formulário preenchido." },
  { nome: "Exclua", texto: "O botão Excluir remove na hora e confirma com um aviso." },
  { nome: "Role", texto: "A lista carrega de 10 em 10 conforme você se aproxima do fim." },
];

type Props = { veioDoMenu: boolean };

/**
 * Painel exibido na primeira visita. Quem decide se ele aparece é o servidor,
 * lendo o cookie, então a página já chega com ou sem o painel, sem piscar.
 */
export function BoasVindas({ veioDoMenu }: Props) {
  const [aberto, setAberto] = useState(true);
  const router = useRouter();

  if (!aberto) return null;

  function fechar() {
    document.cookie = `${COOKIE_BOAS_VINDAS}=vista; path=/; max-age=31536000; samesite=lax`;
    setAberto(false);
    if (veioDoMenu) router.replace("/", { scroll: false });
  }

  return (
    <section
      aria-labelledby="titulo-boas-vindas"
      className="relative mb-8 overflow-hidden rounded bg-marinho p-6 text-white shadow-lg sm:p-8 dark:bg-marinho-superficie dark:ring-1 dark:ring-marinho-borda"
    >
      <div className="lambda -right-10 -bottom-24 w-72 opacity-90" aria-hidden="true" />
      <div className="relative">
        <h2 id="titulo-boas-vindas" className="text-2xl font-light tracking-tight sm:text-3xl">
          Suas tarefas, <span className="text-magenta-claro">só suas</span>
          <span className="text-magenta">.</span>
        </h2>
        <p className="mt-2 max-w-xl text-sm text-white/75">
          Esta lista é separada para cada visitante e fica guardada na memória do servidor. Ela
          começa com tarefas de exemplo; as cinco primeiras são um roteiro rápido.
        </p>

        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PASSOS.map((passo, i) => (
            <li key={passo.nome} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-turquesa text-sm font-medium text-turquesa"
              >
                {i + 1}
              </span>
              <p className="text-sm text-white/80">
                <strong className="block font-medium text-white">{passo.nome}</strong>
                {passo.texto}
              </p>
            </li>
          ))}
        </ol>

        <button type="button" onClick={fechar} className="botao-primario mt-6">
          Entendi, começar
        </button>
      </div>
    </section>
  );
}

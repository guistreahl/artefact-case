"use client";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="py-12 text-center">
      <h1 className="titulo-pagina">Não foi possível carregar a página</h1>
      <p className="texto-suave mt-3">Tente de novo em alguns instantes.</p>
      <button type="button" onClick={reset} className="botao-primario mt-6">
        Tentar de novo
      </button>
    </div>
  );
}

"use client";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="py-12 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar a página</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">Tente de novo em alguns instantes.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Tentar de novo
      </button>
    </div>
  );
}

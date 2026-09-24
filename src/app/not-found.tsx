import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-xl font-semibold">Não encontrado</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Esta tarefa não existe ou já foi excluída.
      </p>
      <Link href="/" className="mt-6 inline-block font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        Voltar para a lista
      </Link>
    </div>
  );
}

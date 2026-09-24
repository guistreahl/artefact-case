import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="py-12 text-center">
      <h1 className="titulo-pagina">Não encontrado</h1>
      <p className="texto-suave mt-3">Esta tarefa não existe ou já foi excluída.</p>
      <Link href="/" className="botao-primario mt-6">
        Voltar para a lista
      </Link>
    </div>
  );
}

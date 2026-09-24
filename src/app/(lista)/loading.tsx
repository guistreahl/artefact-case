// Fica só na listagem de propósito. Um loading.tsx na raiz faria o Next
// começar a enviar a resposta de toda página antes de ela terminar, e a
// página de edição responderia 200 mesmo para uma tarefa inexistente.
export default function Carregando() {
  return (
    <ul aria-busy="true" aria-label="Carregando tarefas" className="space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="h-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      ))}
    </ul>
  );
}

// Fuso fixo: o servidor (UTC no Cloud Run) e o navegador precisam gerar o
// mesmo texto, senão a hidratação do React acusa diferença entre os dois.
const formatoData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatarData(iso: string): string {
  return formatoData.format(new Date(iso));
}

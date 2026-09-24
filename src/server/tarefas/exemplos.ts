import type { Tarefa } from "./schema";

type Exemplo = { titulo: string; descricao?: string; concluida?: boolean };

// As seis primeiras ensinam a usar a aplicação fazendo: cada uma pede uma
// ação e diz o que observar. O resto é conteúdo fictício, para a lista ter
// volume e a rolagem infinita ter mais de uma página para carregar.
const TUTORIAL: Exemplo[] = [
  {
    titulo: "Marque esta tarefa como concluída",
    descricao: "Clique no círculo à esquerda. Clique de novo para reabrir a tarefa.",
  },
  {
    titulo: "Edite esta tarefa",
    descricao:
      "O botão Editar abre o formulário já preenchido. Apague o título e tente salvar para ver a validação.",
  },
  {
    titulo: "Exclua esta tarefa",
    descricao: "O botão Excluir remove na hora e mostra um aviso de confirmação no topo.",
  },
  {
    titulo: "Crie uma tarefa nova",
    descricao: "Use o botão Nova tarefa, no alto da página. Ela aparece no início desta lista.",
  },
  {
    titulo: "Arraste esta tarefa para outra posição",
    descricao:
      "Segure o puxador de seis pontos, à esquerda, e solte onde quiser. Pelo teclado: foco no puxador, espaço, setas e espaço de novo.",
  },
  {
    titulo: "Role até o fim da lista",
    descricao: "São 30 tarefas, carregadas de 10 em 10 conforme a rolagem se aproxima do fim.",
  },
];

const FICTICIAS: Exemplo[] = [
  { titulo: "Revisar o roteiro da reunião de segunda", descricao: "Separar os três pontos que precisam de decisão." },
  { titulo: "Comprar café para o escritório", concluida: true },
  { titulo: "Responder o e-mail do fornecedor de papelaria", descricao: "Confirmar prazo de entrega do pedido 4521." },
  { titulo: "Atualizar a planilha de despesas do mês" },
  { titulo: "Marcar consulta no dentista", concluida: true },
  { titulo: "Ler o capítulo 4 do livro de arquitetura", descricao: "Anotar dúvidas sobre filas e mensageria." },
  { titulo: "Organizar as pastas do projeto Horizonte" },
  {
    titulo: "Preparar apresentação do resultado trimestral",
    descricao: "Slides com os números de vendas e a meta do próximo trimestre.",
  },
  { titulo: "Trocar a lâmpada da sala", concluida: true },
  { titulo: "Enviar convite do aniversário da equipe" },
  { titulo: "Testar o novo fluxo de cadastro", descricao: "Cobrir e-mail inválido e senha curta." },
  { titulo: "Renovar a assinatura do serviço de backup", concluida: true },
  { titulo: "Escrever o resumo da retrospectiva" },
  { titulo: "Pagar a conta de internet", concluida: true },
  { titulo: "Agendar a revisão do carro" },
  { titulo: "Estudar testes de ponta a ponta", descricao: "Comparar duas ferramentas num projeto pequeno." },
  { titulo: "Definir o cardápio da confraternização" },
  { titulo: "Revisar o contrato de aluguel", descricao: "Conferir a cláusula de reajuste anual." },
  { titulo: "Montar o plano de estudos do semestre", concluida: true },
  { titulo: "Configurar o backup automático do celular" },
  { titulo: "Pesquisar passagens para as férias", descricao: "Comparar datas de julho e agosto." },
  { titulo: "Limpar a caixa de entrada" },
  { titulo: "Regar as plantas da varanda", concluida: true },
  { titulo: "Fazer a lista de compras da semana", descricao: "Frutas, arroz, feijão, ovos e pão." },
];

/**
 * Uma cópia nova para cada sessão. A primeira tarefa é a mais recente, e as
 * seguintes recuam de 3 em 3 horas, então o tutorial fica no topo da lista.
 * As concluídas registram a conclusão uma hora e meia depois da criação.
 */
export function tarefasDeExemplo(agora: Date): Tarefa[] {
  const HORA = 60 * 60 * 1000;
  return [...TUTORIAL, ...FICTICIAS].map((exemplo, i) => {
    const criacao = agora.getTime() - (i + 1) * 3 * HORA;
    const concluida = exemplo.concluida ?? false;
    return {
      id: crypto.randomUUID(),
      titulo: exemplo.titulo,
      descricao: exemplo.descricao,
      concluida,
      dataConclusao: concluida ? new Date(criacao + 1.5 * HORA).toISOString() : undefined,
      dataCriacao: new Date(criacao).toISOString(),
      posicao: i,
    };
  });
}

import type { Tarefa } from "./schema";

// Conteúdo fictício. Existe para a lista nunca abrir vazia e para a rolagem
// infinita ter mais de uma página para carregar.
const EXEMPLOS: Array<[titulo: string, descricao?: string]> = [
  ["Revisar o roteiro da reunião de segunda", "Separar os três pontos que precisam de decisão."],
  ["Comprar café para o escritório"],
  ["Responder o e-mail do fornecedor de papelaria", "Confirmar prazo de entrega do pedido 4521."],
  ["Atualizar a planilha de despesas do mês"],
  ["Marcar consulta no dentista"],
  ["Ler o capítulo 4 do livro de arquitetura", "Anotar dúvidas sobre filas e mensageria."],
  ["Organizar as pastas do projeto Horizonte"],
  ["Preparar apresentação do resultado trimestral", "Slides com os números de vendas e a meta do próximo trimestre."],
  ["Trocar a lâmpada da sala"],
  ["Enviar convite do aniversário da equipe"],
  ["Testar o novo fluxo de cadastro", "Cobrir e-mail inválido e senha curta."],
  ["Renovar a assinatura do serviço de backup"],
  ["Escrever o resumo da retrospectiva"],
  ["Pagar a conta de internet"],
  ["Agendar a revisão do carro"],
  ["Estudar testes de ponta a ponta", "Comparar Playwright e Cypress num projeto pequeno."],
  ["Levar o notebook para manutenção"],
  ["Definir o cardápio da confraternização"],
  ["Revisar o contrato de aluguel", "Conferir cláusula de reajuste anual."],
  ["Montar o plano de estudos do semestre"],
  ["Doar as roupas que não servem mais"],
  ["Configurar o backup automático do celular"],
  ["Pesquisar passagens para as férias", "Comparar datas de julho e agosto."],
  ["Limpar a caixa de entrada"],
  ["Regar as plantas da varanda"],
  ["Imprimir os documentos para o cartório"],
  ["Revisar as metas pessoais do ano"],
  ["Cancelar o teste gratuito do aplicativo de música"],
  ["Separar material para a oficina de sábado"],
  ["Fazer a lista de compras da semana", "Frutas, arroz, feijão, ovos e pão."],
];

/** Uma cópia nova para cada sessão, com datas espaçadas de 3 em 3 horas. */
export function tarefasDeExemplo(agora: Date): Tarefa[] {
  const TRES_HORAS = 3 * 60 * 60 * 1000;
  return EXEMPLOS.map(([titulo, descricao], i) => ({
    id: crypto.randomUUID(),
    titulo,
    descricao,
    dataCriacao: new Date(agora.getTime() - (i + 1) * TRES_HORAS).toISOString(),
  }));
}

/**
 * Tamanho da página da listagem. O SSR e o cliente precisam usar o mesmo
 * valor: ele faz parte da chave do cache, e com valores diferentes o cliente
 * ignoraria a página que veio do servidor e buscaria tudo de novo.
 */
export const TAMANHO_PAGINA = 10;

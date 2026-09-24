# Tarefas

Gerenciador de tarefas em Next.js 15 com tRPC. Criar, listar, editar e
excluir, com a lista guardada em memória no servidor.

**No ar:** <https://tarefas.guistreahl.com.br>

![CI](https://github.com/guistreahl/case-artefact/actions/workflows/ci.yml/badge.svg)

## Rodar localmente

Requer Node.js 22 ou mais recente.

```bash
npm install
npm run dev
```

Abre em <http://localhost:3000>. Nenhuma variável de ambiente é necessária.

Para rodar o build de produção, o mesmo servidor que vai para a imagem Docker:

```bash
npm run build
npm start
```

Ou com Docker, sem instalar Node:

```bash
docker build -t tarefas .
docker run -p 8080:8080 tarefas
```

## Testes

```bash
npm test                          # unidade (Vitest), direto no router do tRPC
npx playwright install chromium   # só na primeira vez
npm run build && npm run test:e2e # navegador (Playwright), contra o build de produção
```

## Como funciona

```
navegador ──► Next.js (App Router)
                 ├─ Server Components ── chamada direta ──┐
                 └─ /api/trpc ◄── cliente tRPC ◄── React  │
                                   │                      │
                                   ▼                      ▼
                              router tRPC ──► Map em memória, uma lista por visitante
```

1. **Listagem com SSR.** A página `/` busca a primeira página de tarefas no
   servidor e entrega o HTML pronto. O mesmo dado vai para o cache do
   TanStack Query no cliente, que continua a rolagem a partir dele.
2. **Rolagem infinita** por cursor: 10 tarefas por vez, carregadas quando o
   fim da lista se aproxima da tela.
3. **Um schema, dois lugares.** O schema Zod de `src/server/tarefas/schema.ts`
   valida o formulário no navegador e a entrada no servidor.
4. **Erros com significado.** `NOT_FOUND` para tarefa inexistente,
   `BAD_REQUEST` com a mensagem de cada campo. O formulário mostra o erro
   embaixo do campo; a lista mostra avisos de sucesso e de erro.
5. **Exclusão otimista.** A tarefa sai da tela na hora e volta, com aviso, se
   o servidor recusar.
6. **Uma lista por visitante.** Um cookie anônimo separa as listas, para que
   quem abre o endereço público veja só o que criou. Toda lista nova começa
   com 30 tarefas fictícias de exemplo.

Como tudo fica em memória, a lista recomeça quando o servidor reinicia. No
Cloud Run, isso acontece depois de alguns minutos sem acesso.

A arquitetura completa, com as decisões e a infraestrutura, está em
[`docs/SDD.md`](docs/SDD.md).

## Estrutura

```
src/
  server/            backend: schema, store em memória, router tRPC
  trpc/              ligação do tRPC com o React (cliente) e com os Server Components
  app/               rotas do Next.js
  components/        lista, formulário e avisos
e2e/                 testes do Playwright
infra/               Terraform do Google Cloud
.github/workflows/   CI e deploy
```

## Deploy

Cada push na `main` que passa no CI é publicado no Cloud Run:

1. A imagem é montada e publicada no Artifact Registry.
2. Uma revisão nova sobe **sem tráfego**, numa URL própria.
3. Os testes do Playwright rodam contra essa URL.
4. Só então a revisão passa a receber 100% do tráfego.

A autenticação no Google usa Workload Identity Federation, sem chave de
service account. A infraestrutura está descrita em [`infra/`](infra/).

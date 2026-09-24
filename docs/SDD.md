# SDD: gerenciador de tarefas

Arquitetura do projeto: o que o case pede, o que foi entregue e como as
partes se conectam, da tela até o Cloud Run.

Publicado em `https://tarefas.guistreahl.com.br`.

---

## 1. O que o case pede

| # | Requisito do case |
|---|---|
| C1 | Aplicação Next.js 15 com tRPC, frontend consumindo os endpoints do backend |
| C2 | Tarefa com `id` gerado automaticamente, `titulo` obrigatório, `descricao` opcional e `dataCriacao` |
| C3 | Criar, listar, atualizar e deletar via tRPC |
| C4 | Lista mantida em memória, sem banco de dados |
| C5 | Nenhuma tarefa criada sem título |
| C6 | Erros com significado, como atualizar uma tarefa inexistente |
| C7 | Listagem com SSR para pré-carregar as tarefas, em layout simples |
| C8 | Exclusão direto na listagem, com mensagem de sucesso ou erro |
| C9 | Formulário de criação e edição com componentes funcionais e hooks |
| C10 | Validação no formulário, impedindo envio sem título |
| C11 | Mensagens de erro do backend e do frontend, com estados de carregamento, sucesso e falha |
| C12 | Bônus: infinite scroll na listagem |
| C13 | Bônus: comentários nas decisões principais e README |
| C14 | Repositório público, sem nenhuma informação sensível |

---

## 2. O que foi entregue

### Requisitos do case

| # | Como foi atendido | Onde |
|---|---|---|
| C1 | Next.js 15.5 (App Router) e tRPC 11 com TanStack Query | `src/trpc/`, `src/app/api/trpc/` |
| C2 | `id` com `crypto.randomUUID()` e `dataCriacao` definidos pelo servidor | `src/server/tarefas/store.ts` |
| C3 | Procedimentos `listar`, `obter`, `criar`, `atualizar` e `remover` | `src/server/tarefas/router.ts` |
| C4 | `Map` em memória no processo do servidor | `src/server/tarefas/store.ts` |
| C5 | O mesmo schema Zod valida no formulário e no servidor | `src/server/tarefas/schema.ts` |
| C6 | `NOT_FOUND` para `id` inexistente, `BAD_REQUEST` com o erro de cada campo | `src/server/tarefas/router.ts`, `src/server/trpc.ts` |
| C7 | Server Component busca a primeira página e entrega o cache hidratado ao cliente | `src/app/(lista)/page.tsx` |
| C8 | Exclusão otimista: a tarefa sai na hora e volta com aviso se o servidor recusar | `src/components/ListaTarefas.tsx` |
| C9 | Um único `FormTarefa` para criar e editar, com `useState` | `src/components/FormTarefa.tsx` |
| C10 | Envio bloqueado com título vazio, erro mostrado embaixo do campo | `src/components/FormTarefa.tsx` |
| C11 | Botões desabilitados durante o envio, avisos de sucesso e erro, estados de lista vazia e de falha | `src/components/` |
| C12 | `useInfiniteQuery` com paginação por cursor e `IntersectionObserver` | `src/components/ListaTarefas.tsx` |
| C13 | Comentários nos pontos de decisão, README e este documento | todo o repositório |
| C14 | Tarefas de exemplo fictícias, nenhuma chave ou segredo no repositório | seção 6.3 |

### Além do enunciado

| O quê | Por quê |
|---|---|
| Uma lista por visitante | O endereço é público. Com uma lista única, cada pessoa veria o que as anteriores escreveram (seção 3.3) |
| Tarefas de exemplo em toda sessão nova | A lista nunca abre vazia e a rolagem infinita tem o que carregar |
| Testes de unidade e de navegador | Vitest no router, Playwright no fluxo completo de criar, editar, excluir e rolar |
| Publicação no Cloud Run | A aplicação no ar, com deploy automático a cada push na `main` |
| Infraestrutura em Terraform | Todo recurso do Google Cloud descrito no repositório |

---

## 3. Aplicação

### 3.1 Stack

| Camada | Escolha |
|---|---|
| Runtime | Node.js 22 LTS |
| Framework | Next.js 15.5, App Router |
| API | tRPC 11 com `@trpc/tanstack-react-query` |
| Cache no cliente | TanStack Query 5 |
| Validação | Zod 4 |
| Estilo | Tailwind CSS 4 |
| Testes | Vitest e Playwright |

**Next.js 15, e não 16:** o case fixa a versão 15. A linha 15.5 segue
recebendo correções.

### 3.2 Estrutura

```
src/
  server/
    tarefas/schema.ts      schemas Zod e o tipo Tarefa
    tarefas/store.ts       Map em memória, paginação por cursor, tarefas de exemplo
    tarefas/router.ts      procedimentos tRPC
    tarefas/exemplos.ts    as 30 tarefas fictícias de toda sessão nova
    tarefas/router.test.ts testes de unidade
    trpc.ts                inicialização do tRPC, sessão obrigatória e formatação de erros
    contexto.ts            contexto das requisições HTTP (lê o cookie)
    sessao.ts              nome do cookie, isolado para o middleware
    root.ts                appRouter e o tipo AppRouter
  trpc/
    client.tsx             provider do tRPC e do QueryClient no cliente
    server.ts              chamadas e prefetch a partir de Server Components
    query-client.ts        configuração do QueryClient, comum aos dois lados
  lib/
    constantes.ts          tamanho da página, igual no SSR e no cliente
    formatar.ts            data em fuso fixo, igual no servidor e no navegador
  app/
    api/trpc/[trpc]/route.ts     adaptador HTTP do tRPC
    api/saude/route.ts           verificação de saúde do Cloud Run
    (lista)/page.tsx             listagem
    (lista)/loading.tsx          esqueleto enquanto a listagem carrega
    tarefas/nova/page.tsx        criação
    tarefas/[id]/editar/page.tsx edição
  components/
    ListaTarefas.tsx
    FormTarefa.tsx
    Aviso.tsx
  middleware.ts            emite o cookie de sessão na primeira visita
e2e/                       testes do Playwright
infra/                     Terraform
scripts/iniciar.mjs        sobe o build standalone localmente
```

O `loading.tsx` fica só no grupo da listagem. Na raiz, ele faria o Next
começar a enviar toda página antes de ela terminar, e a edição de uma tarefa
inexistente responderia com status 200 em vez de 404.

### 3.3 Estado em memória e sessão

O store é um `Map<sessao, Map<id, Tarefa>>`, guardado em `globalThis` para
sobreviver ao hot reload do `next dev`.

Na primeira visita, o `middleware.ts` grava o cookie `sessao` com um UUID
aleatório (`HttpOnly`, `SameSite=Lax`, `Secure` em produção). O contexto do
tRPC lê esse cookie, e cada procedimento opera só na lista daquela sessão.

O cookie foi escolhido, e não o `localStorage`, porque o servidor precisa
das tarefas no momento do SSR. O `localStorage` só existe no navegador. O
cookie chega ao servidor em toda requisição, inclusive na primeira.

**Limites:** até 500 sessões em memória (ao passar disso, sai a mais antiga),
até 200 tarefas por sessão, título até 120 caracteres e descrição até 1000.

### 3.4 Modelo e procedimentos

```ts
type Tarefa = {
  id: string;          // crypto.randomUUID()
  titulo: string;      // 1 a 120 caracteres, sem espaços nas pontas
  descricao?: string;  // até 1000 caracteres
  dataCriacao: string; // ISO 8601, definido pelo servidor
};
```

| Procedimento | Tipo | Entrada | Erros |
|---|---|---|---|
| `tarefas.listar` | query | `{ cursor?, limite }` | `BAD_REQUEST` |
| `tarefas.obter` | query | `{ id }` | `NOT_FOUND` |
| `tarefas.criar` | mutation | `{ titulo, descricao? }` | `BAD_REQUEST`, `TOO_MANY_REQUESTS` |
| `tarefas.atualizar` | mutation | `{ id, titulo, descricao? }` | `BAD_REQUEST`, `NOT_FOUND` |
| `tarefas.remover` | mutation | `{ id }` | `NOT_FOUND` |

`listar` devolve `{ itens, proximoCursor }`, da tarefa mais nova para a mais
antiga. O cursor é o `id` da última tarefa entregue. Com offset, excluir uma
tarefa no meio da rolagem deslocaria a lista e a próxima página pularia um
item. Com cursor, isso não acontece.

### 3.5 Renderização

| Rota | Estratégia | Motivo |
|---|---|---|
| `/` | SSR (`dynamic = 'force-dynamic'`) | Depende do cookie de cada visitante. Sem a flag, o Next poderia gerar a página no build |
| `/tarefas/nova` | Estática | Não depende de dado nenhum |
| `/tarefas/[id]/editar` | SSR | Busca a tarefa no servidor, e um `id` inexistente vira 404 antes de chegar ao cliente |

As datas são formatadas com fuso fixo (`America/Sao_Paulo`). O servidor roda
em UTC e o navegador no fuso local; sem o fuso fixo, os dois gerariam textos
diferentes e o React acusaria erro de hidratação.

**Fluxo da listagem:**

```
requisição GET /
   │  cookie sessao
   ▼
Server Component ── prefetchInfiniteQuery(tarefas.listar) ──► store (chamada direta, sem HTTP)
   │  HTML com a primeira página + cache serializado
   ▼
navegador ── HydrationBoundary ──► useInfiniteQuery começa do cache, sem buscar de novo
   │  rolagem chega ao fim
   ▼
IntersectionObserver ──► GET /api/trpc/tarefas.listar?cursor=...
```

---

## 4. Infraestrutura

### 4.1 Visão geral

```
push na main (guistreahl/case-artefact)
   │
   ▼
GitHub Actions ──OIDC──► Workload Identity Federation
   │                         aceita só este repositório, na branch main
   │                         ▼
   │                     service account "deploy"
   ▼
docker build ──► Artifact Registry   servicos/tarefas:<sha>
                         │
                         ▼
                 Cloud Run "tarefas" (us-central1)
                 identidade "tarefas-run", sem papel nenhum
                         ▲
DNS: CNAME tarefas ► ghs.googlehosted.com + domain mapping do Cloud Run
```

### 4.2 Recursos

Todos descritos em Terraform, em `infra/`.

| Recurso | Configuração |
|---|---|
| APIs | Cloud Run, Artifact Registry, IAM, IAM Credentials, STS |
| Artifact Registry | Repositório Docker `servicos`, mantém as 10 imagens mais recentes |
| SA `deploy` | Publica imagens no repositório e revisões no serviço. Nada além disso |
| SA `tarefas-run` | Identidade do container. Sem papel, porque a aplicação não chama API do Google |
| Workload Identity | Pool e provider para o emissor OIDC do GitHub |
| Cloud Run `tarefas` | Máximo de 1 instância, mínimo de 0, 512 MiB, 1 vCPU, acesso público |
| Domain mapping | `tarefas.guistreahl.com.br` |

O projeto e o faturamento ficam fora do Terraform, porque dependem da conta
de faturamento. O estado do Terraform fica num bucket GCS com versionamento.
O provider do Google é travado em `~> 8.4`, com o `.terraform.lock.hcl`
versionado para Linux, Windows e macOS.

**A imagem pertence à esteira, não ao Terraform.** O serviço é criado com
uma imagem provisória, e o Terraform ignora mudanças de imagem e de tráfego.
Sem isso, cada `terraform apply` desfaria o último deploy.

### 4.3 Uma instância só

Cada instância do Cloud Run tem a sua própria memória. Com duas, uma tarefa
criada numa instância não apareceria para uma requisição atendida pela
outra. Por isso o serviço roda com no máximo uma instância, que atende até
80 requisições simultâneas.

Com mínimo de zero, o Cloud Run desliga a instância depois de alguns minutos
sem acesso, e a memória vai junto. A próxima visita encontra a lista
reiniciada com as tarefas de exemplo. O case dispensa persistência, e isso é
comportamento esperado.

### 4.4 Imagem

Dockerfile em três estágios (dependências, build, execução) sobre
`node:22-alpine`, com o `output: 'standalone'` do Next. A imagem final roda
com usuário sem privilégio e escuta na porta recebida em `PORT`.

O `npm start` sobe esse mesmo servidor standalone, então os testes de
navegador do CI rodam contra o que vai para a imagem.

---

## 5. Esteira

### `ci.yml`: todo pull request e todo push

Três jobs em paralelo:

| Job | O que faz |
|---|---|
| `verificar` | `npm ci`, lint, tipos, Vitest, `next build` e Playwright contra o build |
| `imagem` | Monta a imagem Docker, sobe um container e espera `/api/saude` responder |
| `infra` | `terraform fmt`, `init` sem backend e `validate` |

### `deploy.yml`: push na `main`

Roda em fila, sem cancelamento, para que o deploy de um commit antigo nunca
termine depois do de um commit mais novo.

1. Autentica no Google pelo Workload Identity
2. Monta a imagem e publica com a tag do commit
3. Cria a revisão nova **sem tráfego**, com uma URL própria
4. Roda o Playwright contra essa URL
5. Passa 100% do tráfego para a revisão nova
6. Confere `/api/saude` na URL do serviço e, sem bloquear, no domínio

Se o passo 4 falhar, o serviço continua na revisão anterior.

---

## 6. Segurança

### 6.1 Sem chave de service account

O GitHub prova por OIDC que a execução veio deste repositório, e o Google
devolve uma credencial de vida curta. Não existe chave para guardar nem para
vazar.

### 6.2 Condição do Workload Identity

```
assertion.repository == 'guistreahl/case-artefact' &&
assertion.ref == 'refs/heads/main'
```

A condição por repositório impede que outro repositório use esta identidade.
A condição por branch impede que um pull request obtenha credencial. O CI de
pull request não precisa do Google.

As três referências que o deploy usa (projeto, provider e service account)
ficam em Variables do GitHub. Sozinhas, não dão acesso a nada.

### 6.3 Repositório público

Nenhum segredo, nenhum dado pessoal, nenhum arquivo de estado do Terraform.
Todas as tarefas de exemplo são fictícias.

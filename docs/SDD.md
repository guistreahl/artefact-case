# SDD: gerenciador de tarefas

Arquitetura do projeto: o que o case pede, o que foi entregue e como as
partes se conectam, da tela até o Cloud Run.

Publicado em `https://gerenciador.guistreahl.com.br`.

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

### 2.1 Requisitos do case

| # | Como foi atendido | Onde |
|---|---|---|
| C1 | Next.js 15.5 (App Router) e tRPC 11 com TanStack Query | `src/trpc/`, `src/app/api/trpc/` |
| C2 | `id` com `crypto.randomUUID()` e `dataCriacao` definidos pelo servidor | `src/server/tarefas/store.ts` |
| C3 | Procedimentos `listar`, `obter`, `criar`, `atualizar` e `remover` (mais `concluir` e `mover`, seção 2.2) | `src/server/tarefas/router.ts` |
| C4 | `Map` em memória no processo do servidor | `src/server/tarefas/store.ts` |
| C5 | O mesmo schema Zod valida no formulário e no servidor | `src/server/tarefas/schema.ts` |
| C6 | `NOT_FOUND` para `id` inexistente, `BAD_REQUEST` com o erro de cada campo | `src/server/tarefas/router.ts`, `src/server/trpc.ts` |
| C7 | Server Component busca a primeira página e entrega o cache hidratado ao cliente | `src/app/page.tsx` |
| C8 | Confirmação num diálogo, depois exclusão otimista: a tarefa sai na hora e volta com aviso se o servidor recusar | `src/components/ConfirmarExclusao.tsx`, `src/components/ListaTarefas.tsx` |
| C9 | Um único `FormTarefa` para criar e editar, com `useState` | `src/components/FormTarefa.tsx` |
| C10 | Envio bloqueado com título vazio, erro mostrado embaixo do campo | `src/components/FormTarefa.tsx` |
| C11 | Botões desabilitados durante o envio, avisos flutuantes de sucesso e erro, estados de lista vazia e de falha | `src/components/Avisos.tsx`, `src/components/` |
| C12 | `useInfiniteQuery` com paginação por cursor e `IntersectionObserver` | `src/components/ListaTarefas.tsx` |
| C13 | Comentários nos pontos de decisão, README e este documento | todo o repositório |
| C14 | Tarefas de exemplo fictícias, nenhuma chave ou segredo no repositório | seção 6.4 |

### 2.2 Além do enunciado

| O quê | Por quê |
|---|---|
| Campos `concluida` e `dataConclusao`, e o procedimento `concluir` | É a ação mais comum numa lista de tarefas, e o horário registra quando ela aconteceu. O case pede "pelo menos" os quatro campos, então o modelo pode crescer |
| Confirmação antes de excluir | Excluir não tem volta. Um clique errado no botão não pode apagar uma tarefa |
| Ordem manual por arraste (`posicao` e `mover`) | Numa lista de tarefas, a ordem é a prioridade. Funciona com mouse, toque e teclado (seção 3.6) |
| Avisos flutuantes | Ficam fixos no alto da janela. Um aviso no topo da lista não seria visto por quem está com a página rolada |
| Volta ao mesmo ponto depois de editar | Quem edita uma tarefa lá embaixo não perde o lugar na lista |
| Uma lista por visitante | O endereço é público. Com uma lista única, cada pessoa veria o que as anteriores escreveram (seção 3.3) |
| Painel de boas-vindas e tarefas-roteiro | Quem abre a aplicação pela primeira vez aprende a usar sem ler documentação (seção 3.8) |
| Tarefas de exemplo em toda sessão nova | A lista nunca abre vazia e a rolagem infinita tem o que carregar |
| Design system próprio | Paleta e tipografia inspiradas na identidade da Artefact, em tokens (seção 3.9) |
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
    page.tsx                     listagem
    tarefas/nova/page.tsx        criação
    tarefas/[id]/editar/page.tsx edição
  components/
    ListaTarefas.tsx
    FormTarefa.tsx
    Avisos.tsx             avisos flutuantes, disponíveis para qualquer componente
    BoasVindas.tsx         painel da primeira visita
    ConfirmarExclusao.tsx  diálogo "Você deseja excluir esta tarefa?"
  middleware.ts            emite o cookie de sessão na primeira visita
e2e/                       testes do Playwright
infra/                     Terraform
scripts/iniciar.mjs        sobe o build standalone localmente
```

Não há `loading.tsx`. Com ele, o Next começa a enviar a página antes de ela
terminar, e a edição de uma tarefa inexistente responderia com status 200 em
vez de 404. A espera entre salvar o formulário e ver a lista já é indicada
pelo botão "Salvando...".

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
  concluida: boolean;  // toda tarefa nasce pendente
  dataConclusao?: string; // ISO 8601, gravado ao concluir e apagado ao reabrir
  dataCriacao: string; // ISO 8601, definido pelo servidor
  posicao: number;     // ordem manual: a menor aparece primeiro
};
```

| Procedimento | Tipo | Entrada | Erros |
|---|---|---|---|
| `tarefas.listar` | query | `{ cursor?, limite }` | `BAD_REQUEST` |
| `tarefas.obter` | query | `{ id }` | `NOT_FOUND` |
| `tarefas.criar` | mutation | `{ titulo, descricao? }` | `BAD_REQUEST`, `TOO_MANY_REQUESTS` |
| `tarefas.atualizar` | mutation | `{ id, titulo, descricao? }` | `BAD_REQUEST`, `NOT_FOUND` |
| `tarefas.concluir` | mutation | `{ id, concluida }` | `NOT_FOUND` |
| `tarefas.mover` | mutation | `{ id, depoisDe }` | `NOT_FOUND` |
| `tarefas.remover` | mutation | `{ id }` | `NOT_FOUND` |

`concluir` registra `dataConclusao` com o relógio do servidor. Marcar de novo
uma tarefa já concluída mantém o horário original, e reabrir apaga o horário.
Na tela, a conclusão é otimista com o horário do navegador, trocado pelo do
servidor quando a resposta chega.

`listar` devolve `{ itens, proximoCursor }` na ordem de `posicao`. O cursor
é a posição e o `id` da última tarefa entregue. Com offset, excluir uma
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

### 3.6 Ordem manual

Cada tarefa tem uma `posicao` numérica, e a lista é ordenada por ela. Tarefa
nova recebe uma posição antes da primeira e entra no topo.

`mover({ id, depoisDe })` coloca a tarefa logo abaixo de `depoisDe`, ou no
topo com `null`. A posição nova é o ponto médio entre as duas vizinhas, então
só a tarefa movida muda. Quando as vizinhas ficam próximas demais para caber
um número entre elas (menos de 10⁻⁹), a lista inteira é renumerada.

Na tela, o arraste usa o dnd-kit:

1. **Puxador** de seis pontos à esquerda de cada tarefa. Só ele inicia o
   arraste, para o checkbox, os links e a rolagem no celular continuarem
   funcionando normalmente.
2. **Mouse e toque** começam depois de 5px de movimento, para um clique no
   puxador não virar arraste.
3. **Teclado:** foco no puxador, espaço pega, setas movem, espaço solta, Esc
   cancela. Os anúncios para leitor de tela estão em português.
4. **Otimista:** a tarefa fica onde foi solta, e a lista é recarregada depois
   da resposta do servidor. Se ele recusar, a ordem anterior volta, com aviso.

### 3.7 Confirmação de exclusão

O botão Excluir abre um diálogo: "Você deseja excluir esta tarefa?", com o
título da tarefa e os botões Cancelar e Excluir. É o `<dialog>` nativo, aberto
com `showModal()`: o navegador prende o foco dentro dele, fecha com Esc, deixa
o resto da página inerte e devolve o foco ao botão de origem. O foco começa
em Cancelar, a opção que não destrói nada. Só a confirmação dispara o
procedimento `remover`.

### 3.8 Primeira visita

Na primeira visita, a listagem abre com um painel de boas-vindas que explica
em seis passos como concluir, criar, editar, excluir, reordenar e rolar. Ao fechar, um
cookie `boas-vindas` registra que ele foi visto. Quem decide mostrar o painel
é o servidor, lendo esse cookie no SSR, então a página já chega com ou sem
ele e nada pisca na tela. O link "Como usar" do cabeçalho abre a listagem com
`?ajuda=1`, e o painel volta.

As seis primeiras tarefas de exemplo repetem o roteiro na prática: cada uma
pede uma ação ("Marque esta tarefa como concluída", "Edite esta tarefa") e
diz o que observar.

### 3.9 Design system

Tokens do Tailwind 4, declarados em `@theme` no `src/app/globals.css`.
Nenhum componente usa cor fora deles.

| Token | Valor | Uso |
|---|---|---|
| `marinho` | `#002244` | Cabeçalho, texto principal, painel |
| `marinho-profundo` | `#00162e` | Fundo no modo escuro |
| `marinho-superficie` | `#0a2e55` | Cartões no modo escuro |
| `magenta` | `#ff0066` | Ponto final dos títulos, borda de tarefa pendente |
| `magenta-forte` | `#e0005c` | Botões e links |
| `magenta-claro` | `#ff5c9d` | Links no modo escuro |
| `turquesa` | `#65cccc` | Tarefa concluída, números do painel |
| `turquesa-escuro` | `#2ab6bf` | Contorno de foco, borda do aviso de sucesso |
| `nevoa` | `#f0f0f0` | Fundo no modo claro |
| `erro` | `#c4231a` | Mensagens de erro, botão de confirmar exclusão |

**Tipografia:** Roboto (300, 400, 500 e 700), servida pelo próprio app com
`next/font`. Títulos em peso 300.

**Contraste:** o magenta da marca com texto branco fica em 3,9:1, abaixo dos
4,5:1 exigidos para texto pequeno. Botões e links usam o `magenta-forte`
(4,9:1), e o magenta puro fica para detalhes decorativos.

**Componentes** (`@layer components`): `titulo-pagina` (com o ponto final em
magenta), `botao-primario`, `botao-perigo`, `botao-secundario`, `link-acao`, `cartao`,
`campo`, `texto-suave` e `lambda`, o triângulo com brilho magenta desenhado
em CSS.

**Marca:** a interface usa a paleta e a tipografia, mas não o logotipo nem o
nome da empresa como marca do produto.

**Modo escuro** automático, pela preferência do sistema.

---

## 4. Infraestrutura

### 4.1 Visão geral

```
push na main (guistreahl/artefact-case)
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
Cloudflare (proxy): desafio para robôs, limite por IP, cabeçalho secreto
   ▼
DNS: CNAME gerenciador ► ghs.googlehosted.com + domain mapping do Cloud Run
```

### 4.2 Recursos

Todos descritos em Terraform, em `infra/`.

| Recurso | Configuração |
|---|---|
| APIs | Cloud Run, Artifact Registry, IAM, IAM Credentials, STS, Secret Manager |
| Artifact Registry | Repositório Docker `servicos`, mantém as 10 imagens mais recentes |
| SA `deploy` | Publica imagens no repositório e revisões no serviço. Nada além disso |
| SA `tarefas-run` | Identidade do container. Só lê o segredo de origem |
| Secret Manager | `segredo-origem`, gerado pelo Terraform (seção 6.3) |
| Workload Identity | Pool e provider para o emissor OIDC do GitHub |
| Cloud Run `tarefas` | Máximo de 1 instância, mínimo de 0, 512 MiB, 1 vCPU, acesso público |
| Domain mapping | `gerenciador.guistreahl.com.br` |

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
4. Lê o segredo de origem no Secret Manager e roda o Playwright contra essa
   URL, enviando o cabeçalho
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
assertion.repository == 'guistreahl/artefact-case' &&
assertion.ref == 'refs/heads/main'
```

A condição por repositório impede que outro repositório use esta identidade.
A condição por branch impede que um pull request obtenha credencial. O CI de
pull request não precisa do Google.

As três referências que o deploy usa (projeto, provider e service account)
ficam em Variables do GitHub. Sozinhas, não dão acesso a nada.

### 6.3 Proteção contra robôs e ataques comuns

A aplicação só deve ser usada por pessoas. São três camadas, da borda para
dentro:

**1. Cloudflare, com o proxy ligado no registro `gerenciador`**

| Configuração | Efeito |
|---|---|
| Regra personalizada: `http.host eq "gerenciador.guistreahl.com.br"` → *Managed Challenge* | Todo visitante passa pelo desafio do Cloudflare, quase sempre sem interação. Robôs param aqui |
| Bot Fight Mode | Bloqueia robôs conhecidos antes da regra acima |
| Rate limiting: `/api/trpc`, 100 requisições em 10 s por IP → bloqueio | Contém rajadas contra a API |
| Transform Rule: acrescenta `x-origem-cloudflare: <segredo>` | Prova, para a aplicação, que a requisição passou pelo Cloudflare |
| SSL *Full (strict)*, *Always Use HTTPS*, TLS mínimo 1.2 | Tráfego cifrado de ponta a ponta, com o certificado do Google validado |

O proxy só é ligado depois que o Google emite o certificado do domínio: com
ele ligado desde o início, a validação do Google não chega ao Cloud Run.

**2. Trava na origem**

O Cloud Run continua acessível pelo endereço `run.app` e pelos IPs do Google,
e um robô poderia chegar por ali sem passar pelo Cloudflare. Por isso o
`middleware.ts` recusa com 403 toda requisição sem o cabeçalho
`x-origem-cloudflare` com o valor certo, comparado em tempo constante.

O segredo é gerado pelo Terraform (`random_password`), guardado no Secret
Manager e entregue ao container como variável de ambiente. Não está no
repositório. Sem a variável (desenvolvimento, testes, quem roda localmente), a
trava fica desligada. Só `/api/saude` fica de fora, porque a sonda do Cloud
Run não passa pelo Cloudflare, e ela não devolve dado nenhum.

**3. Na aplicação**

1. Até 60 alterações por minuto por IP (`TOO_MANY_REQUESTS` depois disso). O
   contador fica em memória, o que funciona porque o serviço tem uma
   instância só.
2. Limites de tamanho nos campos e de tarefas por sessão (seção 3.3).
3. `robots.txt` com `Disallow: /`, cabeçalho `X-Robots-Tag: noindex` e HSTS.

### 6.4 Repositório público

Nenhum segredo, nenhum dado pessoal, nenhum arquivo de estado do Terraform.
Todas as tarefas de exemplo são fictícias.

import { expect, test } from "@playwright/test";

// Cada teste abre um contexto novo do navegador, com cookie novo, e portanto
// com uma lista própria. Os testes não interferem uns nos outros.

test("a listagem chega pronta do servidor, sem depender de JavaScript", async ({ browser }) => {
  const contexto = await browser.newContext({ javaScriptEnabled: false });
  const pagina = await contexto.newPage();

  await pagina.goto("/");
  await expect(pagina.getByTestId("tarefa")).toHaveCount(10);
  await contexto.close();
});

test("cria, edita e exclui uma tarefa", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Nova tarefa" }).click();

  // Título vazio é barrado antes de chegar ao servidor.
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByText("Informe um título.")).toBeVisible();

  await page.getByLabel("Título").fill("Tarefa do teste");
  await page.getByLabel("Descrição").fill("Criada pelo Playwright");
  await page.getByRole("button", { name: "Criar tarefa" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Tarefa criada" })).toBeVisible();
  const primeira = page.getByTestId("tarefa").first();
  await expect(primeira).toContainText("Tarefa do teste");

  await primeira.getByRole("link", { name: /Editar/ }).click();
  await expect(page.getByLabel("Título")).toHaveValue("Tarefa do teste");
  await page.getByLabel("Título").fill("Tarefa editada");
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Tarefa atualizada" })).toBeVisible();
  await expect(page.getByTestId("tarefa").first()).toContainText("Tarefa editada");

  await page.getByRole("button", { name: "Excluir Tarefa editada" }).click();
  const dialogo = page.getByRole("dialog", { name: "Você deseja excluir esta tarefa?" });
  await expect(dialogo).toContainText("Tarefa editada");
  await dialogo.getByRole("button", { name: "Excluir" }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Tarefa excluída" })).toBeVisible();
  await expect(page.getByText("Tarefa editada")).toHaveCount(0);

  // A exclusão foi no servidor, não só na tela.
  await page.reload();
  await expect(page.getByText("Tarefa editada")).toHaveCount(0);
});

test("cancelar a confirmação, pelo botão ou pelo Esc, mantém a tarefa", async ({ page }) => {
  await page.goto("/");
  const tarefa = page.getByRole("heading", { name: "Exclua esta tarefa" });
  const dialogo = page.getByRole("dialog", { name: "Você deseja excluir esta tarefa?" });

  await page.getByRole("button", { name: "Excluir Exclua esta tarefa" }).click();
  await expect(dialogo).toBeVisible();
  // O foco começa em Cancelar, a opção que não destrói nada.
  await expect(dialogo.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toBeHidden();

  await page.getByRole("button", { name: "Excluir Exclua esta tarefa" }).click();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();

  await page.reload();
  await expect(tarefa).toBeVisible();
});

test("carrega mais tarefas ao rolar até o fim", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("tarefa")).toHaveCount(10);

  await page.getByTestId("tarefa").last().scrollIntoViewIfNeeded();
  await expect(page.getByTestId("tarefa")).toHaveCount(20);

  await page.getByTestId("tarefa").last().scrollIntoViewIfNeeded();
  await expect(page.getByTestId("tarefa")).toHaveCount(30);
  await expect(page.getByText("Fim da lista.")).toBeVisible();
});

test("editar uma tarefa inexistente responde 404", async ({ page }) => {
  const resposta = await page.goto("/tarefas/nao-existe/editar");
  expect(resposta?.status()).toBe(404);
  await expect(page.getByText("Esta tarefa não existe ou já foi excluída.")).toBeVisible();
});

test("marca e desmarca uma tarefa como concluída, e o estado fica no servidor", async ({ page }) => {
  await page.goto("/");
  const caixa = page.getByRole("checkbox", { name: "Marque esta tarefa como concluída" });
  await expect(caixa).not.toBeChecked();

  const item = page.getByTestId("tarefa").filter({ has: caixa });
  // A tela muda antes da resposta (atualização otimista). Antes de recarregar,
  // o teste espera o servidor confirmar, senão o reload cancelaria o pedido.
  const confirmacao = () => page.waitForResponse((r) => r.url().includes("tarefas.concluir") && r.ok());

  let resposta = confirmacao();
  await caixa.check();
  await expect(caixa).toBeChecked();
  await expect(item).toContainText(/Concluída em \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
  await resposta;
  await page.reload();
  await expect(caixa).toBeChecked();
  await expect(item).toContainText("Concluída em");

  resposta = confirmacao();
  await caixa.uncheck();
  await resposta;
  await page.reload();
  await expect(caixa).not.toBeChecked();
  await expect(item).not.toContainText("Concluída");
});

test("o painel de boas-vindas aparece na primeira visita e volta pelo menu", async ({ page }) => {
  const painel = page.getByRole("region", { name: /Suas tarefas, só suas/ });

  await page.goto("/");
  await expect(painel).toBeVisible();

  await page.getByRole("button", { name: "Entendi, começar" }).click();
  await expect(painel).toHaveCount(0);
  await page.reload();
  await expect(painel).toHaveCount(0);

  await page.getByRole("link", { name: "Como usar" }).click();
  await expect(painel).toBeVisible();
  await page.getByRole("button", { name: "Entendi, começar" }).click();
  await expect(painel).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

/** Rola até a terceira página, onde ficam as últimas tarefas de exemplo. */
async function rolarAteOFim(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("tarefa")).toHaveCount(10);
  await page.getByTestId("tarefa").last().scrollIntoViewIfNeeded();
  await expect(page.getByTestId("tarefa")).toHaveCount(20);
  await page.getByTestId("tarefa").last().scrollIntoViewIfNeeded();
  await expect(page.getByTestId("tarefa")).toHaveCount(30);
}

test("o aviso de exclusão aparece na tela mesmo com a lista rolada até o fim", async ({ page }) => {
  await page.goto("/");
  await rolarAteOFim(page);

  await page.getByRole("button", { name: "Excluir Regar as plantas da varanda" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();

  const aviso = page.getByRole("status").filter({ hasText: "Tarefa excluída" });
  await expect(aviso).toBeInViewport();
});

test("depois de editar uma tarefa lá embaixo, volta para o mesmo ponto da lista", async ({ page }) => {
  await page.goto("/");
  await rolarAteOFim(page);

  await page.getByRole("link", { name: "Editar Regar as plantas da varanda" }).click();
  await page.getByLabel("Título").fill("Regar as plantas e o jardim");
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page.getByRole("heading", { name: "Regar as plantas e o jardim" })).toBeInViewport();
  await expect(page.getByRole("status").filter({ hasText: "Tarefa atualizada" })).toBeInViewport();
});

test("move uma tarefa pelo teclado, e a ordem fica no servidor", async ({ page }) => {
  await page.goto("/");
  const titulos = page.getByTestId("tarefa").getByRole("heading");
  await expect(titulos.first()).toHaveText("Marque esta tarefa como concluída");

  // Espaço pega, seta para cima move uma posição, espaço solta.
  const movido = page.waitForResponse((r) => r.url().includes("tarefas.mover") && r.ok());
  await page.getByRole("button", { name: "Mover Edite esta tarefa" }).focus();
  // Pausas curtas entre as teclas, no ritmo de uma pessoa: o dnd-kit mede as
  // posições da lista entre um passo e outro.
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");

  await expect(titulos.nth(0)).toHaveText("Edite esta tarefa");
  await expect(titulos.nth(1)).toHaveText("Marque esta tarefa como concluída");
  await movido;
  await page.reload();
  await expect(titulos.nth(0)).toHaveText("Edite esta tarefa");
});

test("move uma tarefa arrastando com o mouse", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Entendi, começar" }).click();
  const titulos = page.getByTestId("tarefa").getByRole("heading");

  const puxador = page.getByRole("button", { name: "Mover Exclua esta tarefa" });
  const destino = page.getByTestId("tarefa").first();
  const de = (await puxador.boundingBox())!;
  const para = (await destino.boundingBox())!;

  const movido = page.waitForResponse((r) => r.url().includes("tarefas.mover") && r.ok());
  await page.mouse.move(de.x + de.width / 2, de.y + de.height / 2);
  await page.mouse.down();
  await page.mouse.move(de.x + de.width / 2, para.y + 5, { steps: 15 });
  await page.mouse.up();

  await expect(titulos.nth(0)).toHaveText("Exclua esta tarefa");
  await movido;
  await page.reload();
  await expect(titulos.nth(0)).toHaveText("Exclua esta tarefa");
});

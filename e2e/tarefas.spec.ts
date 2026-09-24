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

  await expect(page.getByRole("status")).toHaveText(/Tarefa criada/);
  const primeira = page.getByTestId("tarefa").first();
  await expect(primeira).toContainText("Tarefa do teste");

  await primeira.getByRole("link", { name: /Editar/ }).click();
  await expect(page.getByLabel("Título")).toHaveValue("Tarefa do teste");
  await page.getByLabel("Título").fill("Tarefa editada");
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page.getByRole("status")).toHaveText(/Tarefa atualizada/);
  await expect(page.getByTestId("tarefa").first()).toContainText("Tarefa editada");

  await page.getByRole("button", { name: "Excluir Tarefa editada" }).click();
  await expect(page.getByRole("status")).toHaveText(/Tarefa excluída/);
  await expect(page.getByText("Tarefa editada")).toHaveCount(0);

  // A exclusão foi no servidor, não só na tela.
  await page.reload();
  await expect(page.getByText("Tarefa editada")).toHaveCount(0);
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

  await caixa.check();
  await expect(caixa).toBeChecked();
  await page.reload();
  await expect(caixa).toBeChecked();

  await caixa.uncheck();
  await page.reload();
  await expect(caixa).not.toBeChecked();
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

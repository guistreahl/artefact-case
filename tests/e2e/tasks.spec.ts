import { expect, test, type Page } from "@playwright/test";

// Every test opens a new browser context, with a new cookie and therefore its
// own list. Tests do not interfere with each other.

const originHeader = process.env.ORIGIN_SECRET ? { "x-origin-secret": process.env.ORIGIN_SECRET } : undefined;

/**
 * Scrolls until the three pages (30 tasks) are loaded. Each page is requested
 * when the end of the list gets close to the screen; the scroll repeats until
 * it arrives, instead of scrolling once and hoping the response comes in time.
 */
async function scrollToEnd(page: Page) {
  const tasks = page.getByTestId("task");
  await expect(tasks).toHaveCount(10);
  // "At least": a fast scroll can load pages 2 and 3 back to back, jumping
  // from 10 straight to 30.
  for (const total of [20, 30]) {
    await expect(async () => {
      await tasks.last().scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 1500);
      expect(await tasks.count()).toBeGreaterThanOrEqual(total);
    }).toPass({ timeout: 20_000 });
  }
  await expect(tasks).toHaveCount(30);
}

test("the list arrives rendered from the server, without depending on JavaScript", async ({ browser }) => {
  // A hand-made context does not inherit playwright.config.ts options, so the
  // origin header (used by the deploy) is passed here.
  const context = await browser.newContext({ javaScriptEnabled: false, extraHTTPHeaders: originHeader });
  const page = await context.newPage();

  await page.goto("/");
  await expect(page.getByTestId("task")).toHaveCount(10);
  await context.close();
});

test("creates, edits and deletes a task", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "New task", exact: true }).click();

  // An empty title is blocked before reaching the server.
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByText("Enter a title.")).toBeVisible();

  await page.getByLabel("Title").fill("Test task");
  await page.getByLabel("Description").fill("Created by Playwright");
  await page.getByRole("button", { name: "Create task" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Task created" })).toBeVisible();
  const first = page.getByTestId("task").first();
  await expect(first).toContainText("Test task");

  await first.getByRole("link", { name: /Edit/ }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Test task");
  await page.getByLabel("Title").fill("Edited task");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Task updated" })).toBeVisible();
  await expect(page.getByTestId("task").first()).toContainText("Edited task");

  await page.getByRole("button", { name: "Delete Edited task" }).click();
  const dialog = page.getByRole("dialog", { name: "Do you want to delete this task?" });
  await expect(dialog).toContainText("Edited task");
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Task deleted" })).toBeVisible();
  await expect(page.getByText("Edited task")).toHaveCount(0);

  // The deletion happened on the server, not only on screen.
  await page.reload();
  await expect(page.getByText("Edited task")).toHaveCount(0);
});

test("cancelling the confirmation, by button or by Esc, keeps the task", async ({ page }) => {
  await page.goto("/");
  const task = page.getByRole("heading", { name: "Delete this task" });
  const dialog = page.getByRole("dialog", { name: "Do you want to delete this task?" });

  await page.getByRole("button", { name: "Delete Delete this task" }).click();
  await expect(dialog).toBeVisible();
  // Focus starts on Cancel, the option that destroys nothing.
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Delete Delete this task" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(task).toBeVisible();
});

test("loads more tasks when scrolling to the end", async ({ page }) => {
  await page.goto("/");
  await scrollToEnd(page);
  await expect(page.getByText("End of the list.")).toBeVisible();
});

test("editing a missing task answers 404", async ({ page }) => {
  const response = await page.goto("/tasks/missing/edit");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("This task does not exist or was already deleted.")).toBeVisible();
});

test("ticks and unticks a task as completed, and the state stays on the server", async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("checkbox", { name: "Mark this task as completed" });
  await expect(box).not.toBeChecked();

  const item = page.getByTestId("task").filter({ has: box });
  // The screen changes before the response (optimistic update). Before
  // reloading, the test waits for the server to confirm, otherwise the reload
  // would cancel the request.
  const confirmation = () => page.waitForResponse((r) => r.url().includes("tasks.complete") && r.ok());

  let response = confirmation();
  await box.check();
  await expect(box).toBeChecked();
  await expect(item).toContainText(/Completed [A-Z][a-z]{2} \d{1,2}, \d{4}, \d{2}:\d{2}/);
  await response;
  await page.reload();
  await expect(box).toBeChecked();
  await expect(item).toContainText("Completed");

  response = confirmation();
  await box.uncheck();
  await response;
  await page.reload();
  await expect(box).not.toBeChecked();
  await expect(item).not.toContainText("Completed");
});

test("the welcome panel shows on the first visit and comes back from the menu", async ({ page }) => {
  const panel = page.getByRole("region", { name: /Your tasks, only yours/ });

  await page.goto("/");
  await expect(panel).toBeVisible();

  await page.getByRole("button", { name: "Got it, let's start" }).click();
  await expect(panel).toHaveCount(0);
  await page.reload();
  await expect(panel).toHaveCount(0);

  await page.getByRole("link", { name: "How to use" }).click();
  await expect(panel).toBeVisible();
  await page.getByRole("button", { name: "Got it, let's start" }).click();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test("closing the panel and clicking How to use right away shows it again", async ({ page }) => {
  const panel = page.getByRole("region", { name: /Your tasks, only yours/ });
  await page.goto("/");

  // No reload and no pause in between: a quick close-then-click.
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Got it, let's start" }).click();
    await expect(panel).toHaveCount(0);
    await page.getByRole("link", { name: "How to use" }).click();
    await expect(panel).toBeVisible();
  }
});

test("How to use from another page opens the list with the panel", async ({ page }) => {
  const panel = page.getByRole("region", { name: /Your tasks, only yours/ });
  await page.goto("/");
  await page.getByRole("button", { name: "Got it, let's start" }).click();

  await page.getByRole("link", { name: "New task", exact: true }).click();
  await page.getByRole("link", { name: "How to use" }).click();
  await expect(page).toHaveURL(/\/\?help=1$/);
  await expect(panel).toBeVisible();

  await page.getByRole("button", { name: "Got it, let's start" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(panel).toHaveCount(0);
});

test("the delete notice is visible even with the list scrolled to the end", async ({ page }) => {
  await page.goto("/");
  await scrollToEnd(page);

  await page.getByRole("button", { name: "Delete Water the balcony plants" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Task deleted" })).toBeInViewport();
});

test("after editing a task far down, returns to the same spot in the list", async ({ page }) => {
  await page.goto("/");
  await scrollToEnd(page);

  await page.getByRole("link", { name: "Edit Water the balcony plants" }).click();
  await page.getByLabel("Title").fill("Water the plants and the garden");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: "Water the plants and the garden" })).toBeInViewport();
  await expect(page.getByRole("status").filter({ hasText: "Task updated" })).toBeInViewport();
});

test("moves a task with the keyboard, and the order stays on the server", async ({ page }) => {
  await page.goto("/");
  const titles = page.getByTestId("task").getByRole("heading");
  await expect(titles.first()).toHaveText("Mark this task as completed");

  // Space picks up, arrow up moves one position, space drops.
  const moved = page.waitForResponse((r) => r.url().includes("tasks.move") && r.ok());
  await page.getByRole("button", { name: "Move Edit this task" }).focus();
  // Short pauses between keys, at a person's pace: dnd-kit measures the list
  // positions between steps.
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");

  await expect(titles.nth(0)).toHaveText("Edit this task");
  await expect(titles.nth(1)).toHaveText("Mark this task as completed");
  await moved;
  await page.reload();
  await expect(titles.nth(0)).toHaveText("Edit this task");
});

test("moves a task by dragging with the mouse", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Got it, let's start" }).click();
  const titles = page.getByTestId("task").getByRole("heading");

  const handle = page.getByRole("button", { name: "Move Delete this task" });
  const target = page.getByTestId("task").first();
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;

  const moved = page.waitForResponse((r) => r.url().includes("tasks.move") && r.ok());
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + 5, { steps: 15 });
  await page.mouse.up();

  await expect(titles.nth(0)).toHaveText("Delete this task");
  await moved;
  await page.reload();
  await expect(titles.nth(0)).toHaveText("Delete this task");
});

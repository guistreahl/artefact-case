import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { createCaller } from "../root";
import { MAX_SESSIONS, MAX_TASKS_PER_SESSION, TaskStore } from "./store";

const SAMPLE_COUNT = 2;
/** Enough tasks for several pages: pagination and ordering need volume. */
const VOLUME = 30;

let store: TaskStore;
const caller = (session = "session-a") => createCaller({ session, store });

async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TRPCError) return error.code;
    throw error;
  }
  throw new Error("an error was expected");
}

/** Creates tasks until the session holds `total` of them. */
async function fillTo(total: number, session = "session-a") {
  for (let i = SAMPLE_COUNT; i < total; i++) {
    await caller(session).tasks.create({ titulo: `Task ${i}` });
  }
}

beforeEach(() => {
  store = new TaskStore();
});

describe("create", () => {
  it("generates id and dataCriacao on the server and stores the task", async () => {
    const task = await caller().tasks.create({ titulo: "  Study tRPC  ", descricao: "Read the docs" });

    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(task.dataCriacao)).not.toBeNaN();
    expect(task.titulo).toBe("Study tRPC");
    await expect(caller().tasks.get({ id: task.id })).resolves.toEqual(task);
  });

  it("rejects an empty or whitespace-only title", async () => {
    expect(await errorCode(caller().tasks.create({ titulo: "" }))).toBe("BAD_REQUEST");
    expect(await errorCode(caller().tasks.create({ titulo: "   " }))).toBe("BAD_REQUEST");
  });

  it("treats a blank description as absent", async () => {
    const task = await caller().tasks.create({ titulo: "No description", descricao: "   " });
    expect(task.descricao).toBeUndefined();
  });

  it("rejects the task that would exceed the session limit", async () => {
    for (let i = SAMPLE_COUNT; i < MAX_TASKS_PER_SESSION; i++) {
      await caller().tasks.create({ titulo: `Task ${i}` });
    }
    expect(await errorCode(caller().tasks.create({ titulo: "One too many" }))).toBe("TOO_MANY_REQUESTS");
  });
});

describe("update", () => {
  it("changes title and description, and keeps id and dataCriacao", async () => {
    const original = await caller().tasks.create({ titulo: "Before", descricao: "Old description" });
    const updated = await caller().tasks.update({ id: original.id, titulo: "After" });

    expect(updated).toEqual({ ...original, titulo: "After", descricao: undefined });
  });

  it("returns NOT_FOUND for a missing task", async () => {
    expect(await errorCode(caller().tasks.update({ id: "missing", titulo: "X" }))).toBe("NOT_FOUND");
  });

  it("rejects an empty title", async () => {
    const task = await caller().tasks.create({ titulo: "Valid" });
    expect(await errorCode(caller().tasks.update({ id: task.id, titulo: "" }))).toBe("BAD_REQUEST");
  });
});

describe("complete", () => {
  it("records the completion time and clears it on reopening", async () => {
    let now = new Date("2026-09-24T12:00:00.000Z");
    store = new TaskStore(() => now);
    const task = await caller().tasks.create({ titulo: "Complete me" });
    expect(task.concluida).toBe(false);
    expect(task.dataConclusao).toBeUndefined();

    now = new Date("2026-09-24T15:30:00.000Z");
    const completed = await caller().tasks.complete({ id: task.id, concluida: true });
    expect(completed).toEqual({ ...task, concluida: true, dataConclusao: "2026-09-24T15:30:00.000Z" });

    const reopened = await caller().tasks.complete({ id: task.id, concluida: false });
    expect(reopened.concluida).toBe(false);
    expect(reopened.dataConclusao).toBeUndefined();
  });

  it("completing an already completed task keeps the original time", async () => {
    let now = new Date("2026-09-24T12:00:00.000Z");
    store = new TaskStore(() => now);
    const task = await caller().tasks.create({ titulo: "Only once" });
    await caller().tasks.complete({ id: task.id, concluida: true });

    now = new Date("2026-09-24T18:00:00.000Z");
    const again = await caller().tasks.complete({ id: task.id, concluida: true });
    expect(again.dataConclusao).toBe("2026-09-24T12:00:00.000Z");
  });

  it("editing through the form keeps the completion", async () => {
    const task = await caller().tasks.create({ titulo: "Before" });
    await caller().tasks.complete({ id: task.id, concluida: true });
    const edited = await caller().tasks.update({ id: task.id, titulo: "After" });
    expect(edited.concluida).toBe(true);
    expect(edited.dataConclusao).toBeDefined();
  });

  it("returns NOT_FOUND for a missing task", async () => {
    expect(await errorCode(caller().tasks.complete({ id: "missing", concluida: true }))).toBe("NOT_FOUND");
  });
});

describe("delete", () => {
  it("deletes the task and then returns NOT_FOUND", async () => {
    const task = await caller().tasks.create({ titulo: "Delete me" });

    await expect(caller().tasks.delete({ id: task.id })).resolves.toEqual({ id: task.id });
    expect(await errorCode(caller().tasks.get({ id: task.id }))).toBe("NOT_FOUND");
    expect(await errorCode(caller().tasks.delete({ id: task.id }))).toBe("NOT_FOUND");
  });
});

describe("list", () => {
  it("starts with the sample tasks, newest first", async () => {
    const { items } = await caller().tasks.list({ limit: 50 });

    expect(items).toHaveLength(SAMPLE_COUNT);
    const dates = items.map((t) => t.dataCriacao);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("puts a newly created task at the top", async () => {
    const task = await caller().tasks.create({ titulo: "New" });
    const { items } = await caller().tasks.list({ limit: 1 });
    expect(items[0]?.id).toBe(task.id);
  });

  it("walks every page through the cursor, with no repeats or gaps", async () => {
    await fillTo(VOLUME);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: Awaited<ReturnType<ReturnType<typeof caller>["tasks"]["list"]>> = await caller().tasks.list({
        cursor,
        limit: 7,
      });
      seen.push(...page.items.map((t) => t.id));
      cursor = page.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(VOLUME);
    expect(new Set(seen).size).toBe(VOLUME);
  });

  it("does not skip an item when the page's last task is deleted before the next page", async () => {
    await fillTo(VOLUME);
    const first = await caller().tasks.list({ limit: 10 });
    const expected = (await caller().tasks.list({ limit: 11 })).items[10];

    await caller().tasks.delete({ id: first.items[9]!.id });
    const second = await caller().tasks.list({ cursor: first.nextCursor, limit: 10 });

    expect(second.items[0]?.id).toBe(expected?.id);
  });

  it("returns a null nextCursor on the last page", async () => {
    const page = await caller().tasks.list({ limit: SAMPLE_COUNT });
    expect(page.nextCursor).toBeNull();
  });
});

describe("move", () => {
  const ids = async () => (await caller().tasks.list({ limit: 50 })).items.map((t) => t.id);

  beforeEach(() => fillTo(VOLUME));

  it("moves a task to the top, to the middle and to the end", async () => {
    const initial = await ids();
    const [a, b, c] = initial as [string, string, string];

    await caller().tasks.move({ id: c, after: null });
    expect((await ids()).slice(0, 3)).toEqual([c, a, b]);

    await caller().tasks.move({ id: c, after: a });
    expect((await ids()).slice(0, 3)).toEqual([a, c, b]);

    await caller().tasks.move({ id: a, after: initial.at(-1)! });
    expect((await ids()).at(-1)).toBe(a);
    expect(await ids()).toHaveLength(initial.length);
  });

  it("a task created after a move still goes to the top", async () => {
    const [first, second] = (await ids()) as [string, string];
    await caller().tasks.move({ id: second, after: null });
    const created = await caller().tasks.create({ titulo: "New" });
    expect((await ids()).slice(0, 3)).toEqual([created.id, second, first]);
  });

  it("pagination has no repeats or gaps after several moves", async () => {
    const initial = await ids();
    for (let i = 0; i < 10; i++) {
      await caller().tasks.move({ id: initial[i * 2]!, after: initial[29 - i]! });
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: { items: { id: string }[]; nextCursor: string | null } = await caller().tasks.list({
        cursor,
        limit: 7,
      });
      seen.push(...page.items.map((t) => t.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(await ids());
    expect(new Set(seen).size).toBe(VOLUME);
  });

  it("renumbers the list when no position fits between two neighbours", async () => {
    const [a, b, c] = (await ids()) as [string, string, string];
    // Each move halves the gap between a and the task right below it.
    for (let i = 0; i < 60; i++) {
      await caller().tasks.move({ id: i % 2 === 0 ? b : c, after: a });
    }
    const order = await ids();
    expect(order[0]).toBe(a);
    expect(new Set(order.slice(1, 3))).toEqual(new Set([b, c]));
    expect(order).toHaveLength(VOLUME);
  });

  it("returns NOT_FOUND for a missing task or reference", async () => {
    const [a] = (await ids()) as [string];
    expect(await errorCode(caller().tasks.move({ id: "missing", after: null }))).toBe("NOT_FOUND");
    expect(await errorCode(caller().tasks.move({ id: a, after: "missing" }))).toBe("NOT_FOUND");
  });
});

describe("sessions", () => {
  it("isolates the lists of different visitors", async () => {
    const task = await caller("session-a").tasks.create({ titulo: "Only for session A" });

    expect(await errorCode(caller("session-b").tasks.get({ id: task.id }))).toBe("NOT_FOUND");
    expect(await errorCode(caller("session-b").tasks.delete({ id: task.id }))).toBe("NOT_FOUND");
  });

  it("rejects a call without a session", async () => {
    const noSession = createCaller({ session: undefined, store });
    expect(await errorCode(noSession.tasks.list({}))).toBe("UNAUTHORIZED");
  });

  it("drops the least recently used session when over the limit", async () => {
    const task = await caller("first").tasks.create({ titulo: "Will be gone" });
    for (let i = 0; i < MAX_SESSIONS; i++) {
      await caller(`other-${i}`).tasks.list({ limit: 1 });
    }
    expect(await errorCode(caller("first").tasks.get({ id: task.id }))).toBe("NOT_FOUND");
  });
});

import type { Task, TaskInput } from "./schema";
import { sampleTasks } from "./samples";

export const MAX_SESSIONS = 500;
export const MAX_TASKS_PER_SESSION = 200;

export class TaskLimitError extends Error {}

export type Page = {
  items: Task[];
  nextCursor: string | null;
};

/**
 * Keeps tasks in memory, one list per visitor session.
 *
 * Nothing here survives a process restart, and that is intentional: the case
 * does not require persistence. Sessions are separated because the app lives
 * at a public address, and with a single list every visitor would see what
 * the previous ones wrote.
 */
export class TaskStore {
  // Map keeps insertion order. Every access reinserts the session at the end,
  // so the first key is always the least recently used one.
  private readonly sessions = new Map<string, Map<string, Task>>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  private tasksOf(session: string): Map<string, Task> {
    let tasks = this.sessions.get(session);
    if (tasks) {
      this.sessions.delete(session);
    } else {
      tasks = new Map(sampleTasks(this.now()).map((t) => [t.id, t]));
      if (this.sessions.size >= MAX_SESSIONS) {
        const oldest = this.sessions.keys().next().value;
        if (oldest !== undefined) this.sessions.delete(oldest);
      }
    }
    this.sessions.set(session, tasks);
    return tasks;
  }

  private sorted(session: string): Task[] {
    return [...this.tasksOf(session).values()].sort(byPosition);
  }

  /**
   * Cursor pagination, in the list's manual order.
   *
   * The cursor carries the position and id of the last task delivered, not an
   * index. Deleting a task mid-scroll does not make the next page skip an
   * item, and the cursor stays valid even if the task that produced it was
   * deleted.
   */
  list(session: string, cursor: string | null | undefined, limit: number): Page {
    const sorted = this.sorted(session);
    const rest = cursor ? sorted.filter((t) => compareWithCursor(t, cursor) > 0) : sorted;
    const items = rest.slice(0, limit);
    const last = items.at(-1);
    const hasMore = rest.length > limit;
    return { items, nextCursor: hasMore && last ? toCursor(last) : null };
  }

  get(session: string, id: string): Task | undefined {
    return this.tasksOf(session).get(id);
  }

  create(session: string, input: TaskInput): Task {
    const tasks = this.tasksOf(session);
    if (tasks.size >= MAX_TASKS_PER_SESSION) {
      throw new TaskLimitError(
        `Limit of ${MAX_TASKS_PER_SESSION} tasks reached. Delete one to create another.`,
      );
    }
    // A new task goes to the top: one position before the first.
    const first = this.sorted(session)[0];
    const task: Task = {
      id: crypto.randomUUID(),
      titulo: input.titulo,
      descricao: input.descricao,
      concluida: false,
      dataCriacao: this.now().toISOString(),
      posicao: first ? first.posicao - 1 : 0,
    };
    tasks.set(task.id, task);
    return task;
  }

  update(session: string, id: string, input: TaskInput): Task | undefined {
    const tasks = this.tasksOf(session);
    const current = tasks.get(id);
    if (!current) return undefined;
    // The edit form never changes id, dates or completion.
    const updated: Task = { ...current, titulo: input.titulo, descricao: input.descricao };
    tasks.set(id, updated);
    return updated;
  }

  setCompleted(session: string, id: string, concluida: boolean): Task | undefined {
    const tasks = this.tasksOf(session);
    const current = tasks.get(id);
    if (!current) return undefined;
    // Completing an already completed task keeps the recorded time.
    if (current.concluida === concluida) return current;
    const updated: Task = {
      ...current,
      concluida,
      dataConclusao: concluida ? this.now().toISOString() : undefined,
    };
    tasks.set(id, updated);
    return updated;
  }

  /**
   * Places the task right below `after`, or at the top with null.
   *
   * The new position is the midpoint between the two neighbours, so only the
   * moved task changes. When the neighbours get too close for a number to fit
   * between them, the whole list is renumbered.
   */
  move(session: string, id: string, after: string | null): Task | undefined {
    const tasks = this.tasksOf(session);
    const moved = tasks.get(id);
    if (!moved) return undefined;
    if (after !== null && (after === id || !tasks.has(after))) return undefined;

    let others = this.sorted(session).filter((t) => t.id !== id);
    let posicao = positionAfter(others, after);
    if (posicao === undefined) {
      others.forEach((t, i) => tasks.set(t.id, { ...t, posicao: i }));
      others = this.sorted(session).filter((t) => t.id !== id);
      posicao = positionAfter(others, after) as number;
    }

    const updated: Task = { ...moved, posicao };
    tasks.set(id, updated);
    return updated;
  }

  delete(session: string, id: string): boolean {
    return this.tasksOf(session).delete(id);
  }
}

/** Smallest gap accepted between two positions before renumbering. */
const MIN_GAP = 1e-9;

/** Position right below `after`, or undefined if there is no room. */
function positionAfter(sorted: Task[], after: string | null): number | undefined {
  const index = after === null ? -1 : sorted.findIndex((t) => t.id === after);
  const above = sorted[index];
  const below = sorted[index + 1];
  if (!above) return below ? below.posicao - 1 : 0;
  if (!below) return above.posicao + 1;
  if (below.posicao - above.posicao < MIN_GAP) return undefined;
  return (above.posicao + below.posicao) / 2;
}

function byPosition(a: Pick<Task, "posicao" | "id">, b: Pick<Task, "posicao" | "id">): number {
  if (a.posicao !== b.posicao) return a.posicao - b.posicao;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Neither the number nor the UUID contains "_", so it separates both parts
// without ambiguity.
function toCursor(task: Task): string {
  return `${task.posicao}_${task.id}`;
}

/** Positive when the task comes after the cursor in list order. */
function compareWithCursor(task: Task, cursor: string): number {
  const separator = cursor.indexOf("_");
  const posicao = Number(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  return byPosition(task, { posicao, id });
}

// One instance per process. Kept on globalThis because `next dev` reloads
// modules on every change, and without this the list would reset on every
// saved file.
const global = globalThis as typeof globalThis & { __taskStore?: TaskStore };
export const store = (global.__taskStore ??= new TaskStore());

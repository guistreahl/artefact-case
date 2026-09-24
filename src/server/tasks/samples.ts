import type { Task } from "./schema";

type Sample = { titulo: string; descricao?: string };

// Two tasks, so the list never opens empty and there is something to
// complete, drag, edit and delete right away. Two is also the minimum for
// dragging to make sense. The welcome panel explains the rest.
const SAMPLES: Sample[] = [
  {
    titulo: "Mark this task as completed",
    descricao: "Click the circle on the left. Click it again to reopen the task.",
  },
  {
    titulo: "Drag this task above the other one",
    descricao: "Hold the six-dot handle on the left. Edit and Delete are on the right.",
  },
];

/**
 * A fresh copy for every session. The first task is the most recent, and the
 * second goes back 3 hours.
 */
export function sampleTasks(now: Date): Task[] {
  const HOUR = 60 * 60 * 1000;
  return SAMPLES.map((sample, i) => ({
    id: crypto.randomUUID(),
    titulo: sample.titulo,
    descricao: sample.descricao,
    concluida: false,
    dataCriacao: new Date(now.getTime() - (i + 1) * 3 * HOUR).toISOString(),
    posicao: i,
  }));
}

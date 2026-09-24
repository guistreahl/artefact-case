import type { Task } from "./schema";

type Sample = { titulo: string; descricao?: string; concluida?: boolean };

// The first six teach how to use the app by doing: each one asks for an
// action and says what to look for. The rest is fictional content, so the
// list has volume and the infinite scroll has more than one page to load.
const TUTORIAL: Sample[] = [
  {
    titulo: "Mark this task as completed",
    descricao: "Click the circle on the left. Click it again to reopen the task.",
  },
  {
    titulo: "Edit this task",
    descricao: "The Edit button opens the form already filled in. Clear the title and try to save to see the validation.",
  },
  {
    titulo: "Delete this task",
    descricao: "The Delete button asks for confirmation, removes the task and shows a notice at the top.",
  },
  {
    titulo: "Create a new task",
    descricao: "Use the New task button at the top of the page. It shows up at the start of this list.",
  },
  {
    titulo: "Drag this task to another position",
    descricao:
      "Hold the six-dot handle on the left and drop it anywhere. With the keyboard: focus the handle, then space, arrows and space again.",
  },
  {
    titulo: "Scroll to the end of the list",
    descricao: "There are 30 tasks, loaded 10 at a time as the scroll gets close to the end.",
  },
];

const FICTIONAL: Sample[] = [
  { titulo: "Review the agenda for Monday's meeting", descricao: "Pick the three points that need a decision." },
  { titulo: "Buy coffee for the office", concluida: true },
  { titulo: "Reply to the stationery supplier", descricao: "Confirm the delivery date for order 4521." },
  { titulo: "Update this month's expense sheet" },
  { titulo: "Book a dentist appointment", concluida: true },
  { titulo: "Read chapter 4 of the architecture book", descricao: "Write down questions about queues and messaging." },
  { titulo: "Tidy up the Horizon project folders" },
  {
    titulo: "Prepare the quarterly results presentation",
    descricao: "Slides with the sales numbers and next quarter's target.",
  },
  { titulo: "Replace the living room light bulb", concluida: true },
  { titulo: "Send the team birthday invitation" },
  { titulo: "Test the new sign-up flow", descricao: "Cover invalid email and short password." },
  { titulo: "Renew the backup service subscription", concluida: true },
  { titulo: "Write the retrospective summary" },
  { titulo: "Pay the internet bill", concluida: true },
  { titulo: "Schedule the car service" },
  { titulo: "Study end-to-end testing", descricao: "Compare two tools on a small project." },
  { titulo: "Plan the menu for the team party" },
  { titulo: "Review the rental contract", descricao: "Check the yearly adjustment clause." },
  { titulo: "Put together the study plan for the semester", concluida: true },
  { titulo: "Set up automatic phone backups" },
  { titulo: "Look up flights for the holidays", descricao: "Compare dates in July and August." },
  { titulo: "Clean up the inbox" },
  { titulo: "Water the balcony plants", concluida: true },
  { titulo: "Make this week's grocery list", descricao: "Fruit, rice, beans, eggs and bread." },
];

/**
 * A fresh copy for every session. The first task is the most recent, and each
 * following one goes back 3 hours, so the tutorial sits at the top of the
 * list. Completed ones record completion an hour and a half after creation.
 */
export function sampleTasks(now: Date): Task[] {
  const HOUR = 60 * 60 * 1000;
  return [...TUTORIAL, ...FICTIONAL].map((sample, i) => {
    const created = now.getTime() - (i + 1) * 3 * HOUR;
    const concluida = sample.concluida ?? false;
    return {
      id: crypto.randomUUID(),
      titulo: sample.titulo,
      descricao: sample.descricao,
      concluida,
      dataConclusao: concluida ? new Date(created + 1.5 * HOUR).toISOString() : undefined,
      dataCriacao: new Date(created).toISOString(),
      posicao: i,
    };
  });
}

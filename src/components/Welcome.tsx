"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WELCOME_COOKIE } from "@/lib/constants";

const STEPS = [
  { name: "Complete", text: "Tick the circle next to a task. Click again to reopen it." },
  { name: "Create", text: "The New task button, at the top, opens the form. Title is required." },
  { name: "Edit", text: "Every task has an Edit button that opens the form already filled in." },
  { name: "Delete", text: "The Delete button asks for confirmation before removing." },
  { name: "Reorder", text: "Drag by the six-dot handle on the left of each task." },
  { name: "Scroll", text: "The list loads 10 at a time as you get close to the end." },
];

type Props = { fromMenu: boolean };

/**
 * Panel shown on the first visit. The server decides whether it appears, by
 * reading the cookie, so the page already arrives with or without the panel
 * and nothing flickers.
 */
export function Welcome({ fromMenu }: Props) {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  if (!open) return null;

  function close() {
    document.cookie = `${WELCOME_COOKIE}=seen; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    if (fromMenu) router.replace("/", { scroll: false });
  }

  return (
    <section
      aria-labelledby="welcome-title"
      className="relative mb-8 overflow-hidden rounded bg-navy p-6 text-white shadow-lg sm:p-8 dark:bg-navy-surface dark:ring-1 dark:ring-navy-border"
    >
      <div className="lambda -right-10 -bottom-24 w-72 opacity-90" aria-hidden="true" />
      <div className="relative">
        <h2 id="welcome-title" className="text-2xl font-light tracking-tight sm:text-3xl">
          Your tasks, <span className="text-magenta-light">only yours</span>
          <span className="text-magenta">.</span>
        </h2>
        <p className="mt-2 max-w-xl text-sm text-white/75">
          This list is separate for each visitor and kept in the server&apos;s memory. It starts with
          sample tasks; the first six are a quick walkthrough.
        </p>

        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.name} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-teal text-sm font-medium text-teal"
              >
                {i + 1}
              </span>
              <p className="text-sm text-white/80">
                <strong className="block font-medium text-white">{step.name}</strong>
                {step.text}
              </p>
            </li>
          ))}
        </ol>

        <button type="button" onClick={close} className="btn-primary mt-6">
          Got it, let&apos;s start
        </button>
      </div>
    </section>
  );
}

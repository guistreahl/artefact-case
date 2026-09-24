"use client";

import { useEffect, useRef } from "react";
import type { Task } from "@/server/tasks/schema";

type Props = {
  /** The task to confirm. With null, the dialog stays closed. */
  task: Task | null;
  onConfirm: (task: Task) => void;
  onClose: () => void;
};

/**
 * Asks for confirmation before deleting.
 *
 * Uses the native <dialog> with showModal(): the browser already traps focus
 * inside it, closes it on Esc, makes the rest of the page inert and returns
 * focus to the button that opened it. Focus starts on Cancel, the option that
 * destroys nothing.
 */
export function ConfirmDelete({ task, onConfirm, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (task && !element.open) element.showModal();
    if (!task && element.open) element.close();
  }, [task]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-text"
      className="card m-auto w-[calc(100%-2rem)] max-w-md p-6 text-navy backdrop:bg-navy/60 dark:text-white"
    >
      <h2 id="confirm-delete-title" className="text-xl font-light tracking-tight">
        Do you want to delete this task?
      </h2>
      <p id="confirm-delete-text" className="text-muted mt-3 text-sm">
        <strong className="font-medium text-navy dark:text-white">{task?.titulo}</strong> will be removed from the
        list. This cannot be undone.
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button type="button" onClick={() => task && onConfirm(task)} className="btn-danger">
          Delete
        </button>
      </div>
    </dialog>
  );
}

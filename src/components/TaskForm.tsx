"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { z } from "zod";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/server/root";
import { DESCRIPTION_MAX, taskInputSchema, TITLE_MAX, type Task } from "@/server/tasks/schema";
import { useToast } from "./Toasts";

type Fields = { titulo: string; descricao: string };
type FieldErrors = Partial<Record<keyof Fields, string>>;

/** Validates with the server's own schema. Returns only the first message per field. */
function validate(fields: Fields): FieldErrors {
  const result = taskInputSchema.safeParse(fields);
  if (result.success) return {};
  const { fieldErrors } = z.flattenError(result.error);
  return { titulo: fieldErrors.titulo?.[0], descricao: fieldErrors.descricao?.[0] };
}

type Props = {
  /** Without a task, the form creates. With a task, it edits. */
  task?: Task;
  /**
   * Came from the list. On save or cancel it goes back through history
   * instead of opening the list again, and the browser restores the scroll to
   * where the person left, with the edited task in view.
   */
  returnToList?: boolean;
};

export function TaskForm({ task, returnToList = false }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const showToast = useToast();
  const editing = task !== undefined;

  const [fields, setFields] = useState<Fields>({
    titulo: task?.titulo ?? "",
    descricao: task?.descricao ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  // Before the first submit attempt there are no errors on screen: saying
  // "enter a title" before the person even started typing is noise.
  const [triedToSubmit, setTriedToSubmit] = useState(false);
  const [done, setDone] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);

  const create = useMutation(trpc.tasks.create.mutationOptions());
  const update = useMutation(trpc.tasks.update.mutationOptions());
  const saving = create.isPending || update.isPending || done;

  function change(field: keyof Fields, value: string) {
    const next = { ...fields, [field]: value };
    setFields(next);
    if (triedToSubmit) setErrors(validate(next));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTriedToSubmit(true);
    setGeneralError(null);

    const localErrors = validate(fields);
    setErrors(localErrors);
    if (localErrors.titulo || localErrors.descricao) {
      titleInput.current?.focus();
      return;
    }

    try {
      if (editing) {
        const updated = await update.mutateAsync({ id: task.id, ...fields });
        // Writes the new version to the list cache before going back, so the
        // task does not show the old text for a moment.
        queryClient.setQueriesData({ queryKey: trpc.tasks.list.pathKey() }, (data) => replaceInList(data, updated));
      } else {
        await create.mutateAsync(fields);
      }
      setDone(true);
      void queryClient.invalidateQueries({ queryKey: trpc.tasks.list.pathKey() });
      showToast({ kind: "success", message: editing ? "Task updated." : "Task created." });
      leave();
    } catch (error) {
      handleServerError(error);
    }
  }

  // A new task goes to the top of the list, so creating always opens the
  // list from the start. Editing goes back to where the person was.
  function leave() {
    if (returnToList) router.back();
    else router.push("/");
  }

  function handleServerError(error: unknown) {
    if (!(error instanceof TRPCClientError)) {
      setGeneralError("Unexpected error. Please try again.");
      return;
    }
    const { data } = error as TRPCClientError<AppRouter>;
    if (!data) {
      // No response from the server: the request never got there.
      setGeneralError("No connection to the server. Check your internet and try again.");
    } else if (data.validation) {
      const byField = data.validation.fieldErrors as Record<string, string[] | undefined>;
      setErrors({ titulo: byField.titulo?.[0], descricao: byField.descricao?.[0] });
    } else if (data.code === "NOT_FOUND") {
      setGeneralError("This task no longer exists. It may have been deleted in another tab.");
    } else {
      setGeneralError(error.message);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card space-y-5 p-6 sm:p-8" aria-busy={saving}>
      <h1 className="page-title">{editing ? "Edit task" : "New task"}</h1>

      {generalError && (
        <p
          role="alert"
          className="rounded border-l-4 border-error bg-error-bg px-4 py-3 text-sm text-error dark:border-error-light dark:bg-navy-surface dark:text-error-light"
        >
          {generalError}
        </p>
      )}

      <Field id="titulo" label="Title" required error={errors.titulo} counter={`${fields.titulo.length}/${TITLE_MAX}`}>
        {(props) => (
          <input
            {...props}
            ref={titleInput}
            type="text"
            value={fields.titulo}
            onChange={(e) => change("titulo", e.target.value)}
            maxLength={TITLE_MAX}
            autoFocus={!editing}
            autoComplete="off"
          />
        )}
      </Field>

      <Field
        id="descricao"
        label="Description"
        error={errors.descricao}
        counter={`${fields.descricao.length}/${DESCRIPTION_MAX}`}
      >
        {(props) => (
          <textarea
            {...props}
            rows={5}
            value={fields.descricao}
            onChange={(e) => change("descricao", e.target.value)}
            maxLength={DESCRIPTION_MAX}
          />
        )}
      </Field>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving..." : editing ? "Save changes" : "Create task"}
        </button>
        {returnToList ? (
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Cancel
          </button>
        ) : (
          <Link href="/" className="btn-secondary">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}

type ListPages = { pages: Array<{ items: Task[] }> };

function replaceInList(data: unknown, task: Task): unknown {
  const list = data as ListPages | undefined;
  if (!list?.pages) return data;
  return {
    ...list,
    pages: list.pages.map((p) => ({ ...p, items: p.items.map((t) => (t.id === task.id ? task : t)) })),
  };
}

type ControlProps = {
  id: string;
  name: string;
  required?: boolean;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
  className: string;
};

type FieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  counter: string;
  children: (props: ControlProps) => React.ReactNode;
};

/** Label, control and error message linked by id, for screen readers. */
function Field({ id, label, required, error, counter, children }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-magenta-strong dark:text-magenta-light"> *</span>}
        </label>
        <span className="text-muted text-xs">{counter}</span>
      </div>
      {children({
        id,
        name: id,
        required,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? errorId : undefined,
        className: "field",
      })}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-error dark:text-error-light">
          {error}
        </p>
      )}
    </div>
  );
}

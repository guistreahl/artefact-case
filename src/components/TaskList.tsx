"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTRPC } from "@/trpc/client";
import { PAGE_SIZE } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Task } from "@/server/tasks/schema";
import { ConfirmDelete } from "./ConfirmDelete";
import { useToast } from "./Toasts";

export function TaskList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [toDelete, setToDelete] = useState<Task | null>(null);

  // Same options as the prefetch in app/page.tsx. The first page is already
  // in the cache, from the server, so this query does not fire a request.
  const input = { limit: PAGE_SIZE };
  const list = useInfiniteQuery(
    trpc.tasks.list.infiniteQueryOptions(input, {
      getNextPageParam: (page) => page.nextCursor,
    }),
  );
  const listKey = trpc.tasks.list.infiniteQueryKey(input);

  // Applies a change to the tasks of every page already loaded.
  const updateCache = useCallback(
    (change: (items: Task[]) => Task[]) =>
      queryClient.setQueryData(listKey, (data) =>
        data && { ...data, pages: data.pages.map((p) => ({ ...p, items: change(p.items) })) },
      ),
    [queryClient, listKey],
  );

  // Deleting, completing and moving are optimistic: the screen changes before
  // the server answers. If the server refuses, the list goes back to its
  // previous state.
  const remove = useMutation(
    trpc.tasks.delete.mutationOptions({
      onMutate: async ({ id }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData(listKey);
        updateCache((items) => items.filter((t) => t.id !== id));
        return { previous };
      },
      onError: (error, _variables, result) => {
        if (result?.previous) queryClient.setQueryData(listKey, result.previous);
        showToast({ kind: "error", message: `Could not delete: ${error.message}` });
      },
      onSuccess: () => showToast({ kind: "success", message: "Task deleted." }),
      onSettled: () => queryClient.invalidateQueries({ queryKey: trpc.tasks.list.pathKey() }),
    }),
  );

  const complete = useMutation(
    trpc.tasks.complete.mutationOptions({
      onMutate: async ({ id, concluida }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData(listKey);
        // Provisional time from the browser clock. The server's replaces it as
        // soon as the response arrives.
        const dataConclusao = concluida ? new Date().toISOString() : undefined;
        updateCache((items) => items.map((t) => (t.id === id ? { ...t, concluida, dataConclusao } : t)));
        return { previous };
      },
      onSuccess: (task) => updateCache((items) => items.map((t) => (t.id === task.id ? task : t))),
      onError: (error, _variables, result) => {
        if (result?.previous) queryClient.setQueryData(listKey, result.previous);
        showToast({ kind: "error", message: `Could not update: ${error.message}` });
      },
      // No success notice: the ticked circle itself is the confirmation.
    }),
  );

  // The task stays where it was dropped, and the server only records the
  // position. Pages keep their previous sizes, so the next page's cursor
  // stays consistent.
  const move = useMutation(
    trpc.tasks.move.mutationOptions({
      onMutate: async ({ id, after }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData(listKey);
        queryClient.setQueryData(listKey, (data) => {
          if (!data) return data;
          const all = data.pages.flatMap((p) => p.items);
          const moved = all.find((t) => t.id === id);
          if (!moved) return data;
          const others = all.filter((t) => t.id !== id);
          const target = after === null ? 0 : others.findIndex((t) => t.id === after) + 1;
          others.splice(target, 0, moved);
          let start = 0;
          return {
            ...data,
            pages: data.pages.map((p) => {
              const items = others.slice(start, start + p.items.length);
              start += p.items.length;
              return { ...p, items };
            }),
          };
        });
        return { previous };
      },
      onError: (error, _variables, result) => {
        if (result?.previous) queryClient.setQueryData(listKey, result.previous);
        showToast({ kind: "error", message: `Could not move: ${error.message}` });
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: trpc.tasks.list.pathKey() }),
    }),
  );

  // Mouse or touch dragging only starts after 5px of movement, so a simple
  // click on the handle does not become a drag. With the keyboard: space
  // picks up, arrows move, space drops, Esc cancels.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Fixed id: without it, dnd-kit generates different ids on the server and
  // in the browser, and React reports a hydration error.
  const dndId = useId();

  // Infinite scroll: an empty element at the end of the list. When it gets
  // close to the visible area, the next page is requested.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // The same id can show up on two pages for a moment, right after a move and
  // before the list reloads. The first occurrence wins.
  const tasks = dedupe(list.data?.pages.flatMap((p) => p.items) ?? []);
  const titles = new Map(tasks.map((t) => [t.id, t.titulo]));

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = tasks.map((t) => t.id);
    const reordered = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    const index = reordered.indexOf(String(active.id));
    move.mutate({ id: String(active.id), after: reordered[index - 1] ?? null });
  }

  return (
    <section aria-label="Task list">
      {list.isError && !list.data ? (
        <LoadError message={list.error.message} onRetry={() => void list.refetch()} />
      ) : tasks.length === 0 ? (
        <Empty />
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements: announcements(titles, tasks.length),
            screenReaderInstructions: {
              draggable:
                "To move the task, press space. Use the up and down arrows, space again to drop, or Esc to cancel.",
            },
          }}
        >
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-3">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={(concluida) => complete.mutate({ id: task.id, concluida })}
                  onDelete={() => setToDelete(task)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <ConfirmDelete
        task={toDelete}
        onConfirm={(task) => {
          setToDelete(null);
          remove.mutate({ id: task.id });
        }}
        onClose={() => setToDelete(null)}
      />

      <div ref={sentinel} aria-hidden="true" />
      <p className="text-muted py-6 text-center text-sm" aria-live="polite">
        {isFetchingNextPage ? (
          "Loading more tasks..."
        ) : list.isFetchNextPageError ? (
          <button type="button" onClick={() => void fetchNextPage()} className="action-link">
            Could not load more. Try again
          </button>
        ) : tasks.length > 0 && !hasNextPage ? (
          "End of the list."
        ) : null}
      </p>
    </section>
  );
}

type ItemProps = {
  task: Task;
  onComplete: (concluida: boolean) => void;
  onDelete: () => void;
};

function dedupe(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter((t) => !seen.has(t.id) && seen.add(t.id));
}

/** What the screen reader announces while dragging. */
function announcements(titles: Map<string, string>, total: number): Announcements {
  const name = (id: string | number) => titles.get(String(id)) ?? "Task";
  const ids = [...titles.keys()];
  const place = (id: string | number) => `position ${ids.indexOf(String(id)) + 1} of ${total}`;
  return {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}, at ${place(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.id)} is over ${place(over.id)}.` : `${name(active.id)} is outside the list.`,
    onDragEnd: ({ active, over }) =>
      over ? `${name(active.id)} dropped at ${place(over.id)}.` : `${name(active.id)} dropped outside the list.`,
    onDragCancel: ({ active }) => `Move cancelled. ${name(active.id)} is back in place.`,
  };
}

function TaskItem({ task, onComplete, onDelete }: ItemProps) {
  const titleId = `task-${task.id}`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    attributes: { roleDescription: "draggable task" },
  });

  // The TanStack Query cache notifies components on the next tick. Without
  // local state, React would reset the checkbox to the old value right after
  // the click and only then tick it, and the box would flicker. When the data
  // changes from outside (server response, an error undoing the change), the
  // local state follows.
  const [completed, setCompleted] = useState(task.concluida);
  const [lastFromServer, setLastFromServer] = useState(task.concluida);
  if (task.concluida !== lastFromServer) {
    setLastFromServer(task.concluida);
    setCompleted(task.concluida);
  }

  function toggle(checked: boolean) {
    setCompleted(checked);
    onComplete(checked);
  }

  return (
    <li
      ref={setNodeRef}
      // Vertical axis only: the task never leaves the column while dragged.
      style={{ transform: CSS.Transform.toString(transform && { ...transform, x: 0 }), transition }}
      data-testid="task"
      data-completed={completed}
      className={`card relative flex items-start gap-3 border-l-4 p-4 ${
        completed ? "border-l-teal" : "border-l-magenta"
      } ${isDragging ? "z-10 shadow-xl ring-2 ring-magenta/60" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Move ${task.titulo}`}
        className={`text-muted -my-1 -ml-2 flex h-8 w-6 shrink-0 touch-none items-center justify-center rounded hover:bg-mist dark:hover:bg-navy-border ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <svg viewBox="0 0 10 16" aria-hidden="true" className="h-4 w-2.5 fill-current">
          <circle cx="2" cy="2" r="1.5" />
          <circle cx="8" cy="2" r="1.5" />
          <circle cx="2" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="2" cy="14" r="1.5" />
          <circle cx="8" cy="14" r="1.5" />
        </svg>
      </button>
      <label className="relative mt-0.5 flex size-6 shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={completed}
          onChange={(e) => toggle(e.target.checked)}
          aria-labelledby={titleId}
          className="peer size-6 cursor-pointer appearance-none rounded-full border-2 border-graphite/50 transition-colors checked:border-teal checked:bg-teal hover:border-teal-dark dark:border-white/40"
        />
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden size-6 p-1 text-navy peer-checked:block"
        >
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </label>

      <div className="min-w-0 flex-1">
        <h2 id={titleId} className={`font-medium break-words ${completed ? "text-muted line-through" : ""}`}>
          {task.titulo}
        </h2>
        {task.descricao && <p className="text-muted mt-1 text-sm whitespace-pre-line break-words">{task.descricao}</p>}
        <p className="text-muted mt-2 text-xs">
          Created <time dateTime={task.dataCriacao}>{formatDate(task.dataCriacao)}</time>
          {completed &&
            (task.dataConclusao ? (
              <>
                {" · Completed "}
                <time dateTime={task.dataConclusao}>{formatDate(task.dataConclusao)}</time>
              </>
            ) : (
              " · Completed"
            ))}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
        <Link
          href={`/tasks/${task.id}/edit?from=list`}
          aria-label={`Edit ${task.titulo}`}
          className="action-link text-center"
        >
          Edit
        </Link>
        <button type="button" onClick={onDelete} aria-label={`Delete ${task.titulo}`} className="action-link">
          Delete
        </button>
      </div>
    </li>
  );
}

function Empty() {
  return (
    <div className="rounded border border-dashed border-mist-border py-12 text-center dark:border-navy-border">
      <p className="text-muted">No tasks here.</p>
      <Link href="/tasks/new" className="btn-primary mt-4">
        Create the first one
      </Link>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded border-l-4 border-error bg-error-bg p-6 text-center text-error dark:bg-navy-surface dark:text-error-light"
    >
      <p>Could not load the tasks: {message}</p>
      <button type="button" onClick={onRetry} className="btn-secondary mt-3">
        Try again
      </button>
    </div>
  );
}

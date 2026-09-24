import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { TaskForm } from "@/components/TaskForm";
import { caller } from "@/trpc/server";

export const metadata: Metadata = { title: "Edit task" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

// SSR: the task is loaded on the server. A missing id answers 404 before any
// JavaScript runs in the browser.
export default async function EditTaskPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const task = await caller.tasks.get({ id }).catch((error: unknown) => {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  });

  return <TaskForm task={task} returnToList={from === "list"} />;
}

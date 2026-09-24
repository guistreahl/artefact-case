import type { Metadata } from "next";
import Link from "next/link";
import { Provedores } from "@/trpc/client";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tarefas", template: "%s · Tarefas" },
  description: "Gerenciador de tarefas em Next.js com tRPC.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Provedores>
          <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Tarefas
              </Link>
              <Link
                href="/tarefas/nova"
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Nova tarefa
              </Link>
            </div>
          </header>
          <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
        </Provedores>
      </body>
    </html>
  );
}

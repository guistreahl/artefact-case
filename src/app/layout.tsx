import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import Link from "next/link";
import { Provedores } from "@/trpc/client";
import "./globals.css";

// Baixada no build e servida pelo próprio app: o navegador não faz requisição
// ao Google Fonts.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Gerenciador de tarefas", template: "%s · Gerenciador de tarefas" },
  description: "Gerenciador de tarefas em Next.js com tRPC.",
};

export const viewport: Viewport = {
  themeColor: "#002244",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={roboto.variable}>
      <body>
        <Provedores>
          <header className="relative overflow-hidden bg-marinho text-white">
            <div className="lambda -top-6 right-6 w-40 opacity-70 sm:right-24" aria-hidden="true" />
            <div className="relative mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
              <Link href="/" className="text-xl font-light tracking-tight">
                tarefas<span className="text-magenta">.</span>
              </Link>
              <nav className="flex items-center gap-2">
                <Link
                  href="/?ajuda=1"
                  className="rounded px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Como usar
                </Link>
                <Link href="/tarefas/nova" className="botao-primario">
                  Nova tarefa
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </Provedores>
      </body>
    </html>
  );
}

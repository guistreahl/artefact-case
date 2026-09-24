import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { HelpLink } from "@/components/HelpLink";
import { ToastProvider } from "@/components/Toasts";
import { Providers } from "@/trpc/client";
import "./globals.css";

// Font files live in the repository (Roboto, OFL-1.1, from Fontsource) and are
// served by the app itself. Neither the build nor the browser depends on
// Google Fonts: a build once failed when that download returned an
// unexpected response.
const roboto = localFont({
  src: [
    { path: "./fonts/roboto-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/roboto-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/roboto-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/roboto-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Task manager", template: "%s · Task manager" },
  description: "Task manager built with Next.js and tRPC.",
};

export const viewport: Viewport = {
  themeColor: "#002244",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <Providers>
          <ToastProvider>
            <header className="relative overflow-hidden bg-navy text-white">
              <div className="lambda -top-6 right-6 w-40 opacity-70 sm:right-24" aria-hidden="true" />
              <div className="relative mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-4 sm:gap-4">
                <Link href="/" className="text-lg font-light tracking-tight sm:text-xl">
                  gerenciador<span className="text-magenta">.</span>
                </Link>
                {/* whitespace-nowrap keeps each label on one line down to 320px wide. */}
                <nav className="flex items-center gap-1 whitespace-nowrap sm:gap-2">
                  <HelpLink className="rounded px-2 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:px-3" />
                  <Link href="/tasks/new" className="btn-primary px-3 sm:px-4">
                    New task
                  </Link>
                </nav>
              </div>
            </header>
            <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}

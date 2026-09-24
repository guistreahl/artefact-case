import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import Link from "next/link";
import { ToastProvider } from "@/components/Toasts";
import { Providers } from "@/trpc/client";
import "./globals.css";

// Downloaded at build time and served by the app itself: the browser makes no
// request to Google Fonts.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
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
              <div className="relative mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
                <Link href="/" className="text-xl font-light tracking-tight">
                  gerenciador<span className="text-magenta">.</span>
                </Link>
                <nav className="flex items-center gap-2">
                  <Link
                    href="/?help=1"
                    className="rounded px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    How to use
                  </Link>
                  <Link href="/tasks/new" className="btn-primary">
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

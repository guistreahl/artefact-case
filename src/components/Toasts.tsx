"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type Toast = { kind: "success" | "error"; message: string };
type ShownToast = Toast & { id: number };

const ToastContext = createContext<(toast: Toast) => void>(() => {});

/** Shows a floating notice at the top of the window, from any component. */
export const useToast = () => useContext(ToastContext);

const STYLES = {
  success: "border-teal-dark dark:border-teal",
  error: "border-error dark:border-error-light",
};

const ICONS = {
  success: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  error: <path d="M12 7v6M12 17h.01" />,
};

/**
 * Notices fixed to the top of the window, visible at any scroll position.
 *
 * It lives in the layout, above the pages, so a notice raised by the form
 * stays on screen after navigation goes back to the list. A new notice
 * replaces the previous one.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ShownToast | null>(null);
  const counter = useRef(0);

  const show = useCallback((next: Toast) => {
    setToast({ ...next, id: ++counter.current });
  }, []);
  const close = useCallback(() => setToast(null), []);

  // Success disappears on its own. Errors stay until closed, so they are not
  // gone before being read.
  useEffect(() => {
    if (toast?.kind !== "success") return;
    const timer = setTimeout(close, 4000);
    return () => clearTimeout(timer);
  }, [toast, close]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* The aria-live region always exists, even when empty: screen readers
          only announce changes in regions that were already on the page. */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={`card pointer-events-auto flex w-full max-w-md animate-appear items-center gap-3 border-l-4 px-4 py-3 text-sm shadow-lg motion-reduce:animate-none ${STYLES[toast.kind]}`}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`size-5 shrink-0 fill-none stroke-current stroke-[2.5] ${
                toast.kind === "success" ? "text-teal-dark" : "text-error dark:text-error-light"
              }`}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {ICONS[toast.kind]}
            </svg>
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close notice"
              className="text-muted rounded px-1 hover:text-navy dark:hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

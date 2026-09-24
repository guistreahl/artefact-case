"use client";

import Link from "next/link";
import { SHOW_WELCOME_EVENT } from "@/lib/constants";

/**
 * "How to use" in the header.
 *
 * When the welcome panel is on screen (the list page), it reopens the panel in
 * place, without navigating: a navigation there could race with a quick
 * close-then-click and leave the panel hidden. The panel confirms by
 * cancelling the event. With no panel to answer (any other page, or a
 * navigation still in flight), it is a plain link to the list with the panel
 * open.
 */
export function HelpLink({ className }: { className: string }) {
  return (
    <Link
      href="/?help=1"
      className={className}
      onClick={(event) => {
        const handled = !window.dispatchEvent(new Event(SHOW_WELCOME_EVENT, { cancelable: true }));
        if (handled) event.preventDefault();
      }}
    >
      How to use
    </Link>
  );
}

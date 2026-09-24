"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SHOW_WELCOME_EVENT } from "@/lib/constants";

/**
 * "How to use" in the header.
 *
 * On the list page it only reopens the welcome panel, without navigating: a
 * navigation there could race with the one the panel makes when closed, and
 * a quick close-then-click would leave the panel hidden. On any other page it
 * is a plain link to the list with the panel open.
 */
export function HelpLink({ className }: { className: string }) {
  const pathname = usePathname();
  return (
    <Link
      href="/?help=1"
      className={className}
      onClick={(event) => {
        if (pathname !== "/") return;
        event.preventDefault();
        window.dispatchEvent(new Event(SHOW_WELCOME_EVENT));
      }}
    >
      How to use
    </Link>
  );
}

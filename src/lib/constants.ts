/**
 * Page size of the list. The SSR and the client must use the same value: it
 * is part of the cache key, and with different values the client would ignore
 * the page that came from the server and fetch everything again.
 */
export const PAGE_SIZE = 10;

/** Marks that the welcome panel was already closed in this browser. */
export const WELCOME_COOKIE = "welcome";

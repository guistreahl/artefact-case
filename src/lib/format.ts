const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Fixed time zone and numeric parts only: the server (UTC on Cloud Run) and
// the browser must produce the exact same text, or React reports a hydration
// mismatch. Month names come from the array above, not from the runtime's
// locale data, which varies between Node and browser versions.
const parts = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Sao_Paulo",
});

/** "Sep 24, 2026, 14:05", in São Paulo time. */
export function formatDate(iso: string): string {
  const p = Object.fromEntries(parts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${MONTHS[Number(p.month) - 1]} ${p.day}, ${p.year}, ${p.hour}:${p.minute}`;
}

// Used by the deploy's final check. It skips the session middleware and the
// origin check, and returns no data.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}

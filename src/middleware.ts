import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/session";
import { ORIGIN_HEADER, isAllowedOrigin } from "@/server/protection";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Two jobs, in this order.
 *
 * 1. Rejects whatever did not go through Cloudflare. In production,
 *    Cloudflare adds a header carrying a secret, and anyone trying to reach
 *    Cloud Run directly (through the run.app address or Google's IPs) does
 *    not have it.
 *
 * 2. Makes sure every request has the session cookie.
 *
 * On the first visit, the new id is written to the response, for the
 * browser, and also to the request itself. Without the second part, the SSR
 * of the first visit would not see the cookie, which only reaches the server
 * from the following request on.
 */
export function middleware(request: NextRequest) {
  if (!isAllowedOrigin(request.headers.get(ORIGIN_HEADER), process.env.ORIGIN_SECRET)) {
    return new NextResponse("Access denied.", { status: 403 });
  }

  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const session = crypto.randomUUID();
  request.cookies.set(SESSION_COOKIE, session);
  const response = NextResponse.next({ request: { headers: request.headers } });

  // Cloud Run terminates TLS and forwards over HTTP, with the original
  // protocol in this header. Locally, on http://localhost, the cookie is not
  // Secure.
  const https = request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";

  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: ONE_YEAR,
  });
  return response;
}

export const config = {
  // Node runtime, not Edge: the secret is read from the environment at run
  // time, not baked in at build time.
  runtime: "nodejs",
  // /api/health is left out: Cloud Run's probe does not go through Cloudflare.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/health).*)"],
};

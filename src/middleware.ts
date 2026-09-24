import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO } from "@/server/sessao";

const UM_ANO = 60 * 60 * 24 * 365;

/**
 * Garante que toda requisição tenha o cookie de sessão.
 *
 * Na primeira visita, o id novo é gravado na resposta, para o navegador, e
 * também na própria requisição. Sem esta segunda parte, o SSR da primeira
 * visita não enxergaria o cookie, que só chega ao servidor a partir da
 * requisição seguinte.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.has(COOKIE_SESSAO)) return NextResponse.next();

  const sessao = crypto.randomUUID();
  request.cookies.set(COOKIE_SESSAO, sessao);
  const resposta = NextResponse.next({ request: { headers: request.headers } });

  // O Cloud Run termina o TLS e repassa em HTTP, com o protocolo original
  // neste cabeçalho. Localmente, em http://localhost, o cookie fica sem Secure.
  const https =
    request.headers.get("x-forwarded-proto") === "https" || request.nextUrl.protocol === "https:";

  resposta.cookies.set(COOKIE_SESSAO, sessao, {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    maxAge: UM_ANO,
  });
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/saude).*)"],
};

// Usado pela sonda de inicialização do Cloud Run e pela conferência final do
// deploy. Não passa pelo middleware de sessão.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}

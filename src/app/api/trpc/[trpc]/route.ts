import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/root";
import { createRequestContext } from "@/server/context";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createRequestContext(req),
    onError({ path, error }) {
      // 500 errors go to the log (Cloud Logging, on Cloud Run). Expected
      // errors, such as validation and NOT_FOUND, do not clutter it.
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(JSON.stringify({ severity: "ERROR", procedure: path, message: error.message }));
      }
    },
  });
}

export { handler as GET, handler as POST };

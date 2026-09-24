import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Os testes de unidade ficam ao lado do código que testam (src/**/*.test.ts).
// Este arquivo mora em tests/, então a raiz do projeto é a pasta de cima.
export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});

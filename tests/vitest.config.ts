import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests live next to the code they test (src/**/*.test.ts). This file
// lives in tests/, so the project root is the folder above.
export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});

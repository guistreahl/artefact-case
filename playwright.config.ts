import { defineConfig, devices } from "@playwright/test";

// Com BASE_URL definida (o deploy aponta para a revisão nova no Cloud Run), os
// testes rodam contra ela. Sem BASE_URL, sobem o build local.
const urlExterna = process.env.BASE_URL;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: urlExterna ?? "http://localhost:3000",
    // Em produção, a aplicação só responde a quem traz o cabeçalho que o
    // Cloudflare acrescenta. O deploy lê o segredo do Secret Manager e o passa
    // aqui para testar a revisão nova direto no Cloud Run.
    extraHTTPHeaders: process.env.CABECALHO_ORIGEM
      ? { "x-origem-cloudflare": process.env.CABECALHO_ORIGEM }
      : undefined,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: urlExterna
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000/api/saude",
        reuseExistingServer: !process.env.CI,
      },
});

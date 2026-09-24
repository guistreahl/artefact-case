import { defineConfig, devices } from "@playwright/test";

// With BASE_URL set (the deploy points it at the new Cloud Run revision), the
// tests run against it. Without BASE_URL, they start the local build.
const externalUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: "e2e",
  outputDir: "results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: externalUrl ?? "http://localhost:3000",
    // In production the app only answers requests carrying the header that
    // Cloudflare adds. The deploy reads the secret from Secret Manager and
    // passes it here to test the new revision directly on Cloud Run.
    extraHTTPHeaders: process.env.ORIGIN_SECRET ? { "x-origin-secret": process.env.ORIGIN_SECRET } : undefined,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalUrl
    ? undefined
    : {
        command: "npm run start",
        // The server starts from the project root, one folder up.
        cwd: "..",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: !process.env.CI,
      },
});

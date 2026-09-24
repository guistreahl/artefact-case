// Starts the server produced by `output: "standalone"`, the same one that runs
// in the Docker image. Next does not copy static files into the standalone
// folder; this script does that before starting.
import { cpSync, existsSync } from "node:fs";

const standalone = ".next/standalone";
if (!existsSync(`${standalone}/server.js`)) {
  console.error("Build not found. Run `npm run build` first.");
  process.exit(1);
}

cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${standalone}/public`, { recursive: true });

process.chdir(standalone);
await import(new URL(`../${standalone}/server.js`, import.meta.url).href);

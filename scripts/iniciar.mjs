// Sobe o servidor gerado pelo `output: "standalone"`, o mesmo que roda na
// imagem Docker. O Next não copia os arquivos estáticos para dentro do
// standalone; este script faz essa cópia antes de iniciar.
import { cpSync, existsSync } from "node:fs";

const standalone = ".next/standalone";
if (!existsSync(`${standalone}/server.js`)) {
  console.error("Build não encontrado. Rode `npm run build` antes.");
  process.exit(1);
}

cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${standalone}/public`, { recursive: true });

process.chdir(standalone);
await import(new URL(`../${standalone}/server.js`, import.meta.url).href);

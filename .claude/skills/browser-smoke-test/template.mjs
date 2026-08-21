// Template de driver Playwright para smoke test manual do cqntrack.
// Uso: node template.mjs <session_token_decodificado>
// Ver SKILL.md deste diretório para como obter o token.
//
// Copie este arquivo para o scratchpad da sessão e adapte a seção "ROTEIRO"
// abaixo para a feature sendo testada — o resto (setup, cookie, screenshot,
// captura de console) é reutilizável como está.

import { chromium } from "playwright";
import fs from "node:fs";

const OUT_DIR = process.env.SMOKE_TEST_OUT_DIR ?? "./smoke-test-screenshots";
fs.mkdirSync(OUT_DIR, { recursive: true });

const rawToken = process.argv[2];
if (!rawToken) {
  console.error("Uso: node template.mjs <session_token>");
  process.exit(1);
}
const SESSION_TOKEN = decodeURIComponent(rawToken);

const consoleErrors = [];

function shot(page, name) {
  return page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: true });
}

const browser = await chromium.launch();
const context = await browser.newContext();
await context.addCookies([
  {
    name: "better-auth.session_token",
    value: SESSION_TOKEN,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
  },
]);

const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(`[console] ${msg.text()}`);
});
page.on("pageerror", (err) => consoleErrors.push(`[pageerror] ${err.message}`));

try {
  // ===== ROTEIRO — adapte para a feature em teste =====

  console.log("1) Home");
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await shot(page, "01-home");

  // Exemplo: buscar um item
  // await page.goto("http://localhost:5173/<secao>/buscar", { waitUntil: "networkidle" });
  // await page.getByPlaceholder("Título...").fill("Termo real de busca");
  // await page.waitForTimeout(600); // debounce + rede
  // await shot(page, "02-search");

  // Exemplo: abrir detalhe de um item real (prefira ID conhecido a seletor de texto ambíguo)
  // await page.goto("http://localhost:5173/<secao>/<id-real>", { waitUntil: "networkidle" });
  // await page.waitForSelector("h1", { timeout: 15000 });
  // await shot(page, "03-detail");

  // Exemplo: marcar status/favoritar/dar nota
  // await page.getByRole("button", { name: "Lendo", exact: true }).click();
  // await page.waitForTimeout(500);
  // await shot(page, "04-after-action");

  // ===== FIM DO ROTEIRO =====

  console.log("\n=== Console errors coletados ===");
  console.log(consoleErrors.length === 0 ? "Nenhum." : consoleErrors.join("\n"));
} catch (error) {
  console.error("FALHA:", error);
  await shot(page, "ERROR-state");
  process.exitCode = 1;
} finally {
  await browser.close();
}

/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// URL pública do backend por modo de build; não é segredo (fica visível no bundle de qualquer forma).
// "mobile" bate direto em produção — o app empacotado não tem um dev
// server pra fazer proxy de /api (isso só existe no `server.proxy` abaixo,
// que só vale pro `vite dev`), então precisa da URL absoluta mesmo em build
// de desenvolvimento do app.
const API_BASE_URL_BY_MODE: Record<string, string> = {
  production: "https://api.track.cqn.xyz.br",
  mobile: "https://api.track.cqn.xyz.br",
};

// find como regex casando o especificador de import INTEIRO (não o caminho
// já resolvido) — os módulos são importados de profundidades diferentes
// (./lib/api-client, ../lib/api-client, ../../lib/api-client...). O
// Vite/Rollup faz um .replace() usando essa regex — precisa casar a string
// inteira (^.*...$), não só o sufixo "/lib/x", senão só o trecho casado é
// substituído e o prefixo relativo (".", "..") sobra colado na frente do
// caminho absoluto do replacement, quebrando o path (`.` + `G:\...` vira
// `.G:\...`, inválido).
function mobileAlias(moduleName: string, mobileVariant: string) {
  return {
    find: new RegExp(`^.*/lib/${moduleName}$`),
    replacement: fileURLToPath(new URL(`./src/lib/${mobileVariant}.ts`, import.meta.url)),
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  resolve: {
    alias:
      mode === "mobile"
        ? [
            mobileAlias("api-client", "api-client.mobile"),
            mobileAlias("auth-client", "auth-client.mobile"),
          ]
        : [],
  },
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(API_BASE_URL_BY_MODE[mode] ?? ""),
    // Lido em Account.tsx pra não empacotar a seção de importar CSV no
    // build do app Android — ver plano/CLAUDE.md sobre por que essa seção
    // fica de fora do mobile.
    "import.meta.env.VITE_TARGET": JSON.stringify(mode === "mobile" ? "mobile" : "web"),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
  },
}));

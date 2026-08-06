/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// URL pública do backend por modo de build; não é segredo (fica visível no bundle de qualquer forma).
const API_BASE_URL_BY_MODE: Record<string, string> = {
  production: "https://api.track.cqn.xyz.br",
};

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(API_BASE_URL_BY_MODE[mode] ?? ""),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
  },
}));

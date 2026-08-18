/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // "mobile" no build do app Android (ver vite.config.ts), "web" em
  // qualquer outro (dev, produção do site).
  readonly VITE_TARGET?: "mobile" | "web";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

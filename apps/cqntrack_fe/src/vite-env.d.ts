/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // "mobile" no build do app Android (ver vite.config.ts), "web" em
  // qualquer outro (dev, produção do site).
  readonly VITE_TARGET?: "mobile" | "web";
  // Só setado no build mobile — ver vite.config.ts (WEB_ORIGIN_BY_MODE).
  // Vazio em qualquer outro modo; nesse caso usar window.location.origin.
  readonly VITE_WEB_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

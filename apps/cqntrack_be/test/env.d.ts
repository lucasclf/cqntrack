/// <reference types="@cloudflare/vitest-pool-workers/types" />

declare namespace Cloudflare {
  interface Env {
    // Definido em vitest.config.ts, só existe no ambiente de teste.
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}

interface Env {
  TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
}

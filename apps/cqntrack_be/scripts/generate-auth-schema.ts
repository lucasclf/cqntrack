import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

// Instância só para a CLI do better-auth introspectar e gerar o schema Drizzle
// (`pnpm run auth:generate-schema`). Nunca roda em runtime — o client real
// (src/auth/auth.ts) usa drizzle(env.DB, ...) com o binding D1 de verdade.
const db = drizzle(new Database(":memory:"));

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
});

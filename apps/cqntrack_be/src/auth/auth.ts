import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "../db/client";

// Montado por request: o binding env.DB só existe dentro do handler do Worker,
// então a instância do better-auth não pode ser criada em escopo de módulo.
export function createAuth(env: Env) {
  const db = createDb(env);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.FRONTEND_ORIGIN],
    emailAndPassword: {
      enabled: true,
      // Sem provedor de e-mail configurado ainda; débito técnico consciente.
      requireEmailVerification: false,
    },
    advanced: env.COOKIE_DOMAIN
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: env.COOKIE_DOMAIN,
          },
          defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
            httpOnly: true,
          },
        }
      : undefined,
  });
}

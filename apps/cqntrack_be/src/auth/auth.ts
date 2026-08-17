import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
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
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 })],
    advanced: env.COOKIE_DOMAIN
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: env.COOKIE_DOMAIN,
          },
          // "lax" basta: FE (tracker.cqn.xyz.br) e BE (api.track.cqn.xyz.br)
          // são subdomínios do mesmo site registrável (cqn.xyz.br), e
          // crossSubDomainCookies acima já cobre o compartilhamento entre
          // eles — "none" exporia o cookie a mais cenários cross-site do
          // que o necessário, dependendo só da allowlist de CORS como
          // barreira contra CSRF.
          defaultCookieAttributes: {
            sameSite: "lax",
            secure: true,
            httpOnly: true,
          },
        }
      : undefined,
  });
}

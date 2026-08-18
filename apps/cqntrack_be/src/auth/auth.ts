import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, username } from "better-auth/plugins";
import { createDb } from "../db/client";
import { sendEmail } from "../integrations/resend/client";
import { resetPasswordEmailHtml, verificationEmailHtml } from "../integrations/resend/templates";

// Montado por request: o binding env.DB só existe dentro do handler do Worker,
// então a instância do better-auth não pode ser criada em escopo de módulo.
export function createAuth(env: Env) {
  const db = createDb(env);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // better-auth valida o Origin dos requests de auth por conta própria
    // (independente do cors() do Hono em app.ts, que só controla se o
    // browser pode LER a resposta — isso aqui bloqueia o request no
    // servidor antes mesmo de processar). Precisa dos dois origins
    // (web + app mobile) pelo mesmo motivo do cors() em app.ts.
    trustedOrigins: [env.FRONTEND_ORIGIN, env.MOBILE_APP_ORIGIN],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      // Se alguém pediu redefinição de senha, é prudente presumir que a
      // conta pode estar comprometida — derruba sessões existentes junto.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(env, {
          to: user.email,
          subject: "Redefinir senha — cqntrack",
          html: resetPasswordEmailHtml(url),
        });
      },
    },
    // Confirmado em teste: nesse runtime (Cloudflare Workers/D1),
    // sendVerificationEmail já roda em segundo plano por conta própria —
    // o cadastro responde sem esperar o Resend, e se o envio falhar isso só
    // vira log de erro (não derruba o request nem cria uma exceção visível).
    // A conta fica criada normalmente, só sem o e-mail de verificação chegar.
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(env, {
          to: user.email,
          subject: "Confirme seu e-mail — cqntrack",
          html: verificationEmailHtml(url),
        });
      },
      // Se alguém tentar logar antes de verificar, manda um link novo em vez
      // de só bloquear — evita beco sem saída pra quem perdeu o e-mail original.
      sendOnSignIn: true,
    },
    plugins: [
      username({ minUsernameLength: 3, maxUsernameLength: 30 }),
      // Cookie de sessão (crossSubDomainCookies, Domain=.cqn.xyz.br) não
      // funciona no WebView do app Android (Capacitor serve o conteúdo
      // local a partir de https://localhost, sem relação com esse domínio
      // — confirmado que não dá pra contornar via config do Capacitor).
      // bearer() converte um header `Authorization: Bearer <token>` na
      // mesma sessão internamente, sem exigir cookie — coexiste com o
      // login por cookie da web, que continua igual. Token vem no header
      // `set-auth-token` da resposta de login/cadastro (o plugin já expõe
      // esse header via Access-Control-Expose-Headers sozinho); quem lê e
      // guarda esse token é o app mobile (ver auth-client.mobile.ts no FE).
      bearer(),
    ],
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

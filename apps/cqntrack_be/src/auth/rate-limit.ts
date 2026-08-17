import { createMiddleware } from "hono/factory";

// Camada extra de proteção contra força bruta em login/cadastro. O rate
// limit embutido do better-auth usa storage "memory" por padrão, que não é
// confiável em Workers — cada isolate (e cada PoP) tem seu próprio contador
// em memória, então o tráfego de um atacante se espalha e nunca soma no
// mesmo contador. O binding de rate limit do Cloudflare é um contador de
// verdade, compartilhado pela conta.
//
// Aplicado só em POST /api/auth/sign-in/email (ver app.ts) — não no
// catch-all /api/auth/*, que também serve get-session/sign-out/sign-up/
// etc., chamados com frequência normal pela sessão já autenticada ou por
// um fluxo diferente (rate-limitar isso derrubaria uso legítimo, não só
// força bruta contra senha de conta existente).
export const authRateLimit = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const { success } = await c.env.AUTH_RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return c.json({ error: "rate_limited" }, 429);
  }
  await next();
});

import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth";

// Shape de Bindings/Variables de qualquer router que use requireSession —
// `new Hono<AuthedEnv>()` em vez de repetir esse tipo em cada arquivo de rotas.
// (`.use()` não propaga o tipo de Variables do middleware pro router; só
// passar o middleware como argumento por rota faz isso, o que não escala bem
// quando toda rota do domínio precisa de sessão.)
export type AuthedEnv = {
  Bindings: Env;
  Variables: {
    userId: string;
    userEmail: string;
    userName: string;
    username: string;
    displayUsername: string;
  };
};

export const requireSession = createMiddleware<AuthedEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "unauthorized" }, 401);
  }

  // Backstop pra rotas que fazem chamada a API externa por request (busca/
  // descobrir de TMDB, Google Books) — sem isso, um bug de loop no front ou
  // uma conta comprometida martela a cota compartilhada dessas APIs (a do
  // Google Books é por projeto/dia) sem nada barrando. Por userId, não por
  // IP (já autenticado aqui) — mesmo binding de rate limit "de verdade" do
  // Cloudflare usado em rate-limit.ts, não storage em memória do Worker.
  const { success } = await c.env.API_RATE_LIMITER.limit({ key: session.user.id });
  if (!success) {
    return c.json({ error: "rate_limited" }, 429);
  }

  c.set("userId", session.user.id);
  c.set("userEmail", session.user.email);
  c.set("userName", session.user.name);
  c.set("username", session.user.username ?? "");
  c.set("displayUsername", session.user.displayUsername ?? "");
  await next();
});

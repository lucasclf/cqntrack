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

  c.set("userId", session.user.id);
  c.set("userEmail", session.user.email);
  c.set("userName", session.user.name);
  c.set("username", session.user.username ?? "");
  c.set("displayUsername", session.user.displayUsername ?? "");
  await next();
});

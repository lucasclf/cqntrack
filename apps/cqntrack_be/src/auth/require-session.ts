import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth";

export const requireSession = createMiddleware<{
  Bindings: Env;
  Variables: { userId: string; userEmail: string };
}>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "unauthorized" }, 401);
  }

  c.set("userId", session.user.id);
  c.set("userEmail", session.user.email);
  await next();
});

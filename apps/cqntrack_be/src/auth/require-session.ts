import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth";

export const requireSession = createMiddleware<{
  Bindings: Env;
  Variables: {
    userId: string;
    userEmail: string;
    userName: string;
    username: string;
    displayUsername: string;
  };
}>(async (c, next) => {
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

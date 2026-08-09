import { SearchGamesQuerySchema, SearchGamesResponseSchema } from "@cqntrack/shared";
import { Hono } from "hono";
import { requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import { searchGamesForUser } from "./games.service";

export const gamesRouter = new Hono<{ Bindings: Env }>();

gamesRouter.use("*", requireSession);

gamesRouter.get("/search", async (c) => {
  const parsed = SearchGamesQuerySchema.safeParse({
    q: c.req.query("q"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  const results = await searchGamesForUser(c.env, db, parsed.data.q, parsed.data.limit);

  const body = SearchGamesResponseSchema.parse({ results });
  return c.json(body);
});

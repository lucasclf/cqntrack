import { SearchSeriesQuerySchema, SearchSeriesResponseSchema } from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { searchSeriesForUser } from "./series.service";

export const seriesRouter = new Hono<AuthedEnv>();

seriesRouter.use("*", requireSession);

// Rota estática (/search) — precisa continuar vindo antes de qualquer rota
// dinâmica tipo /:tmdbId que entrar numa etapa futura (mesma pegadinha já
// documentada pra /api/games).
seriesRouter.get("/search", async (c) => {
  const parsed = SearchSeriesQuerySchema.safeParse({
    q: c.req.query("q"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const results = await searchSeriesForUser(c.env, parsed.data.q, parsed.data.limit);

  const body = SearchSeriesResponseSchema.parse({ results });
  return c.json(body);
});

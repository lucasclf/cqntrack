import {
  ListSeriesEntriesQuerySchema,
  PaginatedSeriesEntriesResponseSchema,
  SearchSeriesQuerySchema,
  SearchSeriesResponseSchema,
  SeriesDetailResponseSchema,
  SeriesEntrySchema,
  UpsertSeriesEntryRequestSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import { deleteSeriesEntry, getSeriesEntryForUser, listSeriesEntries, upsertSeriesEntry } from "./entries.service";
import { getOrCacheSeries, mapCachedSeriesToSummary, SeriesNotFoundError, searchSeriesForUser } from "./series.service";

export const seriesRouter = new Hono<AuthedEnv>();

seriesRouter.use("*", requireSession);

function parseTmdbId(c: { req: { param: (name: string) => string } }): number | null {
  const tmdbId = Number(c.req.param("tmdbId"));
  return Number.isInteger(tmdbId) ? tmdbId : null;
}

// Rotas estáticas (/search, /entries) precisam vir ANTES de /:tmdbId —
// senão o parâmetro dinâmico captura o segmento literal (mesma pegadinha já
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

seriesRouter.get("/entries", async (c) => {
  const parsed = ListSeriesEntriesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  const { items, total } = await listSeriesEntries(db, c.get("userId"), parsed.data);

  const body = PaginatedSeriesEntriesResponseSchema.parse({
    items,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total,
  });
  return c.json(body);
});

seriesRouter.get("/:tmdbId", async (c) => {
  const tmdbId = parseTmdbId(c);
  if (tmdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    const cachedSeries = await getOrCacheSeries(c.env, db, tmdbId);
    const entry = await getSeriesEntryForUser(db, c.get("userId"), tmdbId);

    const body = SeriesDetailResponseSchema.parse({
      series: { ...mapCachedSeriesToSummary(cachedSeries), overview: cachedSeries.overview },
      entry,
    });
    return c.json(body);
  } catch (error) {
    if (error instanceof SeriesNotFoundError) {
      return c.json({ error: "series_not_found" }, 404);
    }
    throw error;
  }
});

seriesRouter.put("/:tmdbId/entry", async (c) => {
  const tmdbId = parseTmdbId(c);
  if (tmdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = UpsertSeriesEntryRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const entry = await upsertSeriesEntry(c.env, db, c.get("userId"), tmdbId, parsed.data);
    return c.json(SeriesEntrySchema.parse(entry));
  } catch (error) {
    if (error instanceof SeriesNotFoundError) {
      return c.json({ error: "series_not_found" }, 404);
    }
    throw error;
  }
});

seriesRouter.delete("/:tmdbId/entry", async (c) => {
  const tmdbId = parseTmdbId(c);
  if (tmdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  await deleteSeriesEntry(db, c.get("userId"), tmdbId);
  return c.body(null, 204);
});

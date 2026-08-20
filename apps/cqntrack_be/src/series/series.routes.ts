import {
  ContinueWatchingQuerySchema,
  ContinueWatchingResponseSchema,
  DiscoverSeriesQuerySchema,
  DiscoverSeriesResponseSchema,
  ImportTraktSeriesQuerySchema,
  ImportTraktShowRequestSchema,
  ImportTraktShowResponseSchema,
  ImportTvTimeRequestSchema,
  ImportTvTimeResponseSchema,
  ListSeriesEntriesQuerySchema,
  LogTraktSeriesImportActivityRequestSchema,
  LogTvTimeImportActivityRequestSchema,
  PaginatedSeriesEntriesResponseSchema,
  RecentlyWatchedSeriesQuerySchema,
  RecentlyWatchedSeriesResponseSchema,
  SearchSeriesQuerySchema,
  SearchSeriesResponseSchema,
  SeriesDetailResponseSchema,
  SeriesEntrySchema,
  SeriesEpisodeDetailSchema,
  SeriesFavoritesResponseSchema,
  SeriesSeasonEpisodesResponseSchema,
  SetWatchedRequestSchema,
  TraktShowsPreviewResponseSchema,
  UpsertSeriesEntryRequestSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { getContinueWatching } from "./continue-watching.service";
import { createDb } from "../db/client";
import {
  deleteSeriesEntry,
  getFavorites,
  getNextSeasonToWatch,
  getRecentlyWatchedSeries,
  getSeriesEntryForUser,
  listSeriesEntries,
  upsertSeriesEntry,
} from "./entries.service";
import {
  getEpisodeDetail,
  getSeasonEpisodes,
  setEpisodeWatched,
  setSeasonWatched,
} from "./episodes.service";
import {
  getTraktShowsToImport,
  importTraktShow,
  importTvTimeSeries,
  logTraktSeriesImportActivity,
  logTvTimeImportActivity,
} from "./import.service";
import {
  getOrCacheSeries,
  getPopularSeriesForUser,
  mapCachedSeriesCast,
  mapCachedSeriesCreators,
  mapCachedSeriesDirectors,
  mapCachedSeriesToSummary,
  SeriesNotFoundError,
  searchSeriesForUser,
} from "./series.service";

export const seriesRouter = new Hono<AuthedEnv>();

seriesRouter.use("*", requireSession);

function parseTmdbId(c: { req: { param: (name: string) => string } }): number | null {
  const tmdbId = Number(c.req.param("tmdbId"));
  return Number.isInteger(tmdbId) ? tmdbId : null;
}

function parseIntParam(
  c: { req: { param: (name: string) => string } },
  name: string,
): number | null {
  const value = Number(c.req.param(name));
  return Number.isInteger(value) ? value : null;
}

// Rotas estáticas (/search, /entries, /favorites) precisam vir ANTES de
// /:tmdbId — senão o parâmetro dinâmico captura o segmento literal (mesma
// pegadinha já documentada pra /api/games).
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

seriesRouter.get("/favorites", async (c) => {
  const db = createDb(c.env);
  const items = await getFavorites(db, c.get("userId"));
  return c.json(SeriesFavoritesResponseSchema.parse({ items }));
});

// "Conta" > "Importar dados" > CSV do tvtime — 1 série por request (o front
// já agrupa por série, ver ImportTvTimeCsv.tsx) pra não estourar o teto de
// CPU do plano Free de Workers processando episódio por episódio.
seriesRouter.post("/import/tvtime", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = ImportTvTimeRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  const result = await importTvTimeSeries(
    c.env,
    db,
    c.get("userId"),
    parsed.data.seriesTvdbId,
    parsed.data.title,
    parsed.data.episodes,
  );
  return c.json(ImportTvTimeResponseSchema.parse(result));
});

// Chamada 1x pelo front ao final do loop de import (ver logTvTimeImportActivity).
seriesRouter.post("/import/tvtime/activity", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = LogTvTimeImportActivityRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  await logTvTimeImportActivity(
    db,
    c.get("userId"),
    parsed.data.importedSeriesCount,
    parsed.data.importedEpisodeCount,
  );
  return c.body(null, 204);
});

// "Conta" > "Importar dados" > Trakt (só perfil público) — devolve a lista
// pronta pra importar (tmdb_id + episódios já resolvidos pelo próprio
// Trakt, ver getTraktShowsToImport) pro front rodar o mesmo loop (1 série
// por request) que já usa pro tvtime. 404 quando o perfil está privado ou
// o username não existe.
seriesRouter.get("/import/trakt", async (c) => {
  const parsed = ImportTraktSeriesQuerySchema.safeParse({ username: c.req.query("username") });
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const preview = await getTraktShowsToImport(c.env, parsed.data.username);
  if (!preview) {
    return c.json({ error: "trakt_profile_unavailable" }, 404);
  }
  return c.json(TraktShowsPreviewResponseSchema.parse(preview));
});

seriesRouter.post("/import/trakt", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = ImportTraktShowRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  const result = await importTraktShow(
    c.env,
    db,
    c.get("userId"),
    parsed.data.tmdbId,
    parsed.data.title,
    parsed.data.rating,
    parsed.data.episodes,
  );
  return c.json(ImportTraktShowResponseSchema.parse(result));
});

// Chamada 1x pelo front ao final do loop de import (ver logTraktSeriesImportActivity).
seriesRouter.post("/import/trakt/activity", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = LogTraktSeriesImportActivityRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  await logTraktSeriesImportActivity(
    db,
    c.get("userId"),
    parsed.data.importedSeriesCount,
    parsed.data.importedEpisodeCount,
  );
  return c.body(null, 204);
});

// Mesma lógica da rota pública equivalente (/api/users/:username/series/
// recently-watched) — usada pela aba "Séries" da home (dados próprios, ver
// SeriesTab/SeriesStats reaproveitados de profile/).
seriesRouter.get("/recently-watched", async (c) => {
  const parsed = RecentlyWatchedSeriesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  const { items, total } = await getRecentlyWatchedSeries(
    db,
    c.get("userId"),
    parsed.data.page,
    parsed.data.pageSize,
  );
  return c.json(
    RecentlyWatchedSeriesResponseSchema.parse({
      items,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      total,
    }),
  );
});

// "Continuar assistindo" da Home — calculado ao vivo (ver
// continue-watching.service.ts), sem tabela pré-computada por cron.
// Paginado por cursor (rolagem infinita no front, ver ContinueWatching.tsx).
seriesRouter.get("/continue-watching", async (c) => {
  const parsed = ContinueWatchingQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  const { items, nextCursor } = await getContinueWatching(
    c.env,
    db,
    c.get("userId"),
    parsed.data.cursor,
    parsed.data.pageSize,
  );
  return c.json(ContinueWatchingResponseSchema.parse({ items, nextCursor }));
});

seriesRouter.get("/discover", async (c) => {
  const parsed = DiscoverSeriesQuerySchema.safeParse({ page: c.req.query("page") });
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const { results, hasMore } = await getPopularSeriesForUser(c.env, parsed.data.page);
  return c.json(DiscoverSeriesResponseSchema.parse({ results, page: parsed.data.page, hasMore }));
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
    // Sem entry não há episódio assistido (ensureSeriesEntry sempre roda
    // antes de qualquer watch, ver episodes.service.ts) — pula a query.
    const nextSeasonToWatch = entry
      ? await getNextSeasonToWatch(db, c.get("userId"), tmdbId, cachedSeries.seasons ?? [])
      : null;

    const body = SeriesDetailResponseSchema.parse({
      series: {
        ...mapCachedSeriesToSummary(cachedSeries),
        overview: cachedSeries.overview,
        cast: mapCachedSeriesCast(cachedSeries),
        creators: mapCachedSeriesCreators(cachedSeries),
        directors: mapCachedSeriesDirectors(cachedSeries),
      },
      entry,
      nextSeasonToWatch,
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

seriesRouter.get("/:tmdbId/seasons/:seasonNumber", async (c) => {
  const tmdbId = parseTmdbId(c);
  const seasonNumber = parseIntParam(c, "seasonNumber");
  if (tmdbId === null || seasonNumber === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  const season = await getSeasonEpisodes(c.env, db, c.get("userId"), tmdbId, seasonNumber);
  if (!season) {
    return c.json({ error: "season_not_found" }, 404);
  }

  return c.json(SeriesSeasonEpisodesResponseSchema.parse(season));
});

seriesRouter.get("/:tmdbId/episodes/:seasonNumber/:episodeNumber", async (c) => {
  const tmdbId = parseTmdbId(c);
  const seasonNumber = parseIntParam(c, "seasonNumber");
  const episodeNumber = parseIntParam(c, "episodeNumber");
  if (tmdbId === null || seasonNumber === null || episodeNumber === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  const episode = await getEpisodeDetail(
    c.env,
    db,
    c.get("userId"),
    tmdbId,
    seasonNumber,
    episodeNumber,
  );
  if (!episode) {
    return c.json({ error: "episode_not_found" }, 404);
  }

  return c.json(SeriesEpisodeDetailSchema.parse(episode));
});

seriesRouter.put("/:tmdbId/episodes/:seasonNumber/:episodeNumber", async (c) => {
  const tmdbId = parseTmdbId(c);
  const seasonNumber = parseIntParam(c, "seasonNumber");
  const episodeNumber = parseIntParam(c, "episodeNumber");
  if (tmdbId === null || seasonNumber === null || episodeNumber === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = SetWatchedRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    await setEpisodeWatched(
      c.env,
      db,
      c.get("userId"),
      tmdbId,
      seasonNumber,
      episodeNumber,
      parsed.data.watched,
    );
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof SeriesNotFoundError) {
      return c.json({ error: "series_not_found" }, 404);
    }
    throw error;
  }
});

seriesRouter.put("/:tmdbId/seasons/:seasonNumber", async (c) => {
  const tmdbId = parseTmdbId(c);
  const seasonNumber = parseIntParam(c, "seasonNumber");
  if (tmdbId === null || seasonNumber === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = SetWatchedRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const found = await setSeasonWatched(
      c.env,
      db,
      c.get("userId"),
      tmdbId,
      seasonNumber,
      parsed.data.watched,
    );
    if (!found) {
      return c.json({ error: "season_not_found" }, 404);
    }
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof SeriesNotFoundError) {
      return c.json({ error: "series_not_found" }, 404);
    }
    throw error;
  }
});

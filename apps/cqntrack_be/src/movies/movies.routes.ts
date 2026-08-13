import {
  DiscoverMoviesQuerySchema,
  DiscoverMoviesResponseSchema,
  ImportFilmowRequestSchema,
  ImportFilmowResponseSchema,
  ListMovieEntriesQuerySchema,
  MovieDetailResponseSchema,
  MovieEntrySchema,
  MovieFavoritesResponseSchema,
  PaginatedMovieEntriesResponseSchema,
  SearchMoviesQuerySchema,
  SearchMoviesResponseSchema,
  UpsertMovieEntryRequestSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import {
  deleteMovieEntry,
  getFavorites,
  getMovieEntryForUser,
  listMovieEntries,
  upsertMovieEntry,
} from "./entries.service";
import { importFilmowTitles } from "./import.service";
import {
  getOrCacheMovie,
  getPopularMoviesForUser,
  mapCachedMovieCast,
  mapCachedMovieDirectors,
  mapCachedMovieToSummary,
  MovieNotFoundError,
  searchMoviesForUser,
} from "./movies.service";

export const moviesRouter = new Hono<AuthedEnv>();

moviesRouter.use("*", requireSession);

function parseTmdbId(c: { req: { param: (name: string) => string } }): number | null {
  const tmdbId = Number(c.req.param("tmdbId"));
  return Number.isInteger(tmdbId) ? tmdbId : null;
}

// Rotas estáticas (/search, /entries, /favorites) precisam vir ANTES de
// /:tmdbId — senão o parâmetro dinâmico captura o segmento literal (mesma
// pegadinha já documentada pra /api/games e /api/series).
moviesRouter.get("/search", async (c) => {
  const parsed = SearchMoviesQuerySchema.safeParse({
    q: c.req.query("q"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const results = await searchMoviesForUser(c.env, parsed.data.q, parsed.data.limit);

  const body = SearchMoviesResponseSchema.parse({ results });
  return c.json(body);
});

moviesRouter.get("/entries", async (c) => {
  const parsed = ListMovieEntriesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  const { items, total } = await listMovieEntries(db, c.get("userId"), parsed.data);

  const body = PaginatedMovieEntriesResponseSchema.parse({
    items,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total,
  });
  return c.json(body);
});

moviesRouter.get("/favorites", async (c) => {
  const db = createDb(c.env);
  const items = await getFavorites(db, c.get("userId"));
  return c.json(MovieFavoritesResponseSchema.parse({ items }));
});

// "Conta" > "Importar dados" > CSV do Filmow — o front já quebra o CSV em
// lotes pequenos (ver ImportFilmowRequestSchema, max 10 por request) pra
// não estourar o limite de subrequests do Worker nem o rate limit da TMDB.
moviesRouter.post("/import/filmow", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = ImportFilmowRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  const results = await importFilmowTitles(c.env, db, c.get("userId"), parsed.data.titles);
  return c.json(ImportFilmowResponseSchema.parse({ results }));
});

moviesRouter.get("/discover", async (c) => {
  const parsed = DiscoverMoviesQuerySchema.safeParse({ page: c.req.query("page") });
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const { results, hasMore } = await getPopularMoviesForUser(c.env, parsed.data.page);
  return c.json(DiscoverMoviesResponseSchema.parse({ results, page: parsed.data.page, hasMore }));
});

moviesRouter.get("/:tmdbId", async (c) => {
  const tmdbId = parseTmdbId(c);
  if (tmdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    const cachedMovie = await getOrCacheMovie(c.env, db, tmdbId);
    const entry = await getMovieEntryForUser(db, c.get("userId"), tmdbId);

    const body = MovieDetailResponseSchema.parse({
      movie: {
        ...mapCachedMovieToSummary(cachedMovie),
        overview: cachedMovie.overview,
        cast: mapCachedMovieCast(cachedMovie),
        directors: mapCachedMovieDirectors(cachedMovie),
      },
      entry,
    });
    return c.json(body);
  } catch (error) {
    if (error instanceof MovieNotFoundError) {
      return c.json({ error: "movie_not_found" }, 404);
    }
    throw error;
  }
});

moviesRouter.put("/:tmdbId/entry", async (c) => {
  const tmdbId = parseTmdbId(c);
  if (tmdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = UpsertMovieEntryRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const entry = await upsertMovieEntry(c.env, db, c.get("userId"), tmdbId, parsed.data);
    return c.json(MovieEntrySchema.parse(entry));
  } catch (error) {
    if (error instanceof MovieNotFoundError) {
      return c.json({ error: "movie_not_found" }, 404);
    }
    throw error;
  }
});

moviesRouter.delete("/:tmdbId/entry", async (c) => {
  const tmdbId = parseTmdbId(c);
  if (tmdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  await deleteMovieEntry(db, c.get("userId"), tmdbId);
  return c.body(null, 204);
});

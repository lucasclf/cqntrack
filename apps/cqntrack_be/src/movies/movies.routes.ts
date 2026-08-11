import {
  MovieDetailResponseSchema,
  SearchMoviesQuerySchema,
  SearchMoviesResponseSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import { getOrCacheMovie, mapCachedMovieToSummary, MovieNotFoundError, searchMoviesForUser } from "./movies.service";

export const moviesRouter = new Hono<AuthedEnv>();

moviesRouter.use("*", requireSession);

function parseTmdbId(c: { req: { param: (name: string) => string } }): number | null {
  const tmdbId = Number(c.req.param("tmdbId"));
  return Number.isInteger(tmdbId) ? tmdbId : null;
}

// Rota estática (/search) precisa vir ANTES de /:tmdbId — senão o parâmetro
// dinâmico captura o segmento literal (mesma pegadinha já documentada pra
// /api/games e /api/series).
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

moviesRouter.get("/:tmdbId", async (c) => {
  const tmdbId = parseTmdbId(c);
  if (tmdbId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    const cachedMovie = await getOrCacheMovie(c.env, db, tmdbId);

    const body = MovieDetailResponseSchema.parse({
      movie: { ...mapCachedMovieToSummary(cachedMovie), overview: cachedMovie.overview },
      // Marcação do usuário ainda não existe (ver entries.service.ts, chega
      // num commit seguinte) — todo mundo vê "sem marcação" por enquanto.
      entry: null,
    });
    return c.json(body);
  } catch (error) {
    if (error instanceof MovieNotFoundError) {
      return c.json({ error: "movie_not_found" }, 404);
    }
    throw error;
  }
});

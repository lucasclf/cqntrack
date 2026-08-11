import type { MovieSummary } from "@cqntrack/shared";
import { eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { movie } from "../db/schema";
import { getMovieById, searchMovies as tmdbSearchMovies } from "../integrations/tmdb/movies";
import { buildPosterUrl, MOVIE_GENRE_NAMES, type TmdbMovieSearchResult } from "../integrations/tmdb/types";

type Db = ReturnType<typeof createDb>;
export type CachedMovie = typeof movie.$inferSelect;

export class MovieNotFoundError extends Error {
  constructor(public readonly tmdbId: number) {
    super(`Filme ${tmdbId} não encontrado na TMDB`);
    this.name = "MovieNotFoundError";
  }
}

// Campos de snapshot pra gravar na tabela genérica `activity` — mesmo
// formato de toActivitySnapshot em series.service.ts, só trocando o domínio.
export function toActivitySnapshot(cachedMovie: CachedMovie) {
  return {
    mediaType: "movies" as const,
    itemId: String(cachedMovie.tmdbId),
    itemTitle: cachedMovie.name,
    itemHref: `/filmes/${cachedMovie.tmdbId}`,
    itemCoverUrl: cachedMovie.posterPath ? buildPosterUrl(cachedMovie.posterPath, "w342") : null,
  };
}

// Mapeia um resultado de busca da TMDB pro DTO exposto — runtime fica null
// aqui porque a busca não traz esse dado (só o detalhe de cada filme traz,
// ver getOrCacheMovie).
export function mapTmdbSearchResultToSummary(result: TmdbMovieSearchResult): MovieSummary {
  return {
    tmdbId: result.id,
    name: result.title,
    posterUrl: result.poster_path ? buildPosterUrl(result.poster_path, "w342") : null,
    releaseDate:
      result.release_date && result.release_date.length > 0 ? result.release_date : null,
    genres: (result.genre_ids ?? [])
      .map((id) => MOVIE_GENRE_NAMES[id])
      .filter((name): name is string => Boolean(name)),
    runtime: null,
    rating: result.vote_average ?? null,
  };
}

// Mesma forma de mapTmdbSearchResultToSummary, mas a partir de uma linha já
// cacheada no D1 (movie), usada por qualquer rota que leia filmes do
// próprio banco em vez de consultar a TMDB de novo (detalhe, "meus
// filmes", listas etc.).
export function mapCachedMovieToSummary(row: CachedMovie): MovieSummary {
  return {
    tmdbId: row.tmdbId,
    name: row.name,
    posterUrl: row.posterPath ? buildPosterUrl(row.posterPath, "w342") : null,
    releaseDate: row.releaseDate ? row.releaseDate.toISOString().slice(0, 10) : null,
    genres: row.genres ?? [],
    runtime: row.runtime,
    rating: row.rating,
  };
}

export async function searchMoviesForUser(
  env: Env,
  query: string,
  limit: number,
): Promise<MovieSummary[]> {
  const results = await tmdbSearchMovies(env, query, limit);
  return results.map(mapTmdbSearchResultToSummary);
}

// Filme já lançado não ganha "temporada nova" como série, mas a nota
// agregada da TMDB continua indo pra cima com o tempo — mesmo TTL de
// getOrCacheSeries, pelo mesmo motivo (não fica preso pra sempre no que
// foi cacheado da primeira vez).
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isStale(row: CachedMovie): boolean {
  return Date.now() - row.updatedAt.getTime() > CACHE_TTL_MS;
}

function mapMovieDetailToRow(detail: NonNullable<Awaited<ReturnType<typeof getMovieById>>>) {
  return {
    name: detail.title,
    posterPath: detail.poster_path ?? null,
    releaseDate:
      detail.release_date && detail.release_date.length > 0 ? new Date(detail.release_date) : null,
    overview: detail.overview ?? null,
    genres: detail.genres?.map((genre) => genre.name) ?? [],
    runtime: detail.runtime ?? null,
    rating: detail.vote_average ?? null,
  };
}

// Busca o filme no cache local (movie); se não existir OU se o cache
// estiver velho, consulta a TMDB e grava (insert ou update) antes de
// devolver. `onConflictDoNothing` torna o insert seguro sob requests
// concorrentes cacheando o mesmo filme pela primeira vez.
export async function getOrCacheMovie(env: Env, db: Db, tmdbId: number): Promise<CachedMovie> {
  const [cached] = await db.select().from(movie).where(eq(movie.tmdbId, tmdbId));
  if (cached && !isStale(cached)) {
    return cached;
  }

  const detail = await getMovieById(env, tmdbId);
  if (!detail) {
    // TMDB indisponível ou filme removido de lá — melhor devolver o cache
    // velho (se existir) do que quebrar a tela por causa da revalidação.
    if (cached) {
      return cached;
    }
    throw new MovieNotFoundError(tmdbId);
  }

  const values = mapMovieDetailToRow(detail);

  if (cached) {
    await db.update(movie).set(values).where(eq(movie.tmdbId, tmdbId));
  } else {
    await db
      .insert(movie)
      .values({ tmdbId: detail.id, ...values })
      .onConflictDoNothing();
  }

  const [row] = await db.select().from(movie).where(eq(movie.tmdbId, tmdbId));
  if (!row) {
    // Não deveria acontecer (acabamos de inserir, ou outra request concorrente
    // já tinha inserido) — só pra manter o tipo de retorno não-nulo com segurança.
    throw new MovieNotFoundError(tmdbId);
  }
  return row;
}

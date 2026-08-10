import type { SeriesSummary } from "@cqntrack/shared";
import { eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { series } from "../db/schema";
import { getSeriesById, searchSeries as tmdbSearchSeries } from "../integrations/tmdb/series";
import { buildPosterUrl, TV_GENRE_NAMES, type TmdbSeriesSearchResult } from "../integrations/tmdb/types";

type Db = ReturnType<typeof createDb>;
export type CachedSeries = typeof series.$inferSelect;

export class SeriesNotFoundError extends Error {
  constructor(public readonly tmdbId: number) {
    super(`Série ${tmdbId} não encontrada na TMDB`);
    this.name = "SeriesNotFoundError";
  }
}

// Campos de snapshot pra gravar na tabela genérica `activity` — mesmo
// formato de toActivitySnapshot em games.service.ts, só trocando o domínio.
export function toActivitySnapshot(cachedSeries: CachedSeries) {
  return {
    mediaType: "series" as const,
    itemId: String(cachedSeries.tmdbId),
    itemTitle: cachedSeries.name,
    itemHref: `/series/${cachedSeries.tmdbId}`,
    itemCoverUrl: cachedSeries.posterPath ? buildPosterUrl(cachedSeries.posterPath, "w342") : null,
  };
}

// Mapeia um resultado de busca da TMDB pro DTO exposto — numberOfSeasons/
// numberOfEpisodes ficam null aqui porque a busca não traz esse dado (só o
// detalhe de cada série traz, ver getOrCacheSeries).
export function mapTmdbSearchResultToSummary(result: TmdbSeriesSearchResult): SeriesSummary {
  return {
    tmdbId: result.id,
    name: result.name,
    posterUrl: result.poster_path ? buildPosterUrl(result.poster_path, "w342") : null,
    firstAirDate: result.first_air_date && result.first_air_date.length > 0 ? result.first_air_date : null,
    genres: (result.genre_ids ?? [])
      .map((id) => TV_GENRE_NAMES[id])
      .filter((name): name is string => Boolean(name)),
    numberOfSeasons: null,
    numberOfEpisodes: null,
    rating: result.vote_average ?? null,
  };
}

// Mesma forma de mapTmdbSearchResultToSummary, mas a partir de uma linha já
// cacheada no D1 (series), usada por qualquer rota que leia séries do
// próprio banco em vez de consultar a TMDB de novo (detalhe, "minhas
// séries", listas etc.).
export function mapCachedSeriesToSummary(row: CachedSeries): SeriesSummary {
  return {
    tmdbId: row.tmdbId,
    name: row.name,
    posterUrl: row.posterPath ? buildPosterUrl(row.posterPath, "w342") : null,
    firstAirDate: row.firstAirDate ? row.firstAirDate.toISOString().slice(0, 10) : null,
    genres: row.genres ?? [],
    numberOfSeasons: row.numberOfSeasons,
    numberOfEpisodes: row.numberOfEpisodes,
    rating: row.rating,
  };
}

export async function searchSeriesForUser(
  env: Env,
  query: string,
  limit: number,
): Promise<SeriesSummary[]> {
  const results = await tmdbSearchSeries(env, query, limit);
  return results.map(mapTmdbSearchResultToSummary);
}

// Busca a série no cache local (series); se não existir, consulta a TMDB e
// cacheia antes de devolver. `onConflictDoNothing` torna isso seguro sob
// requests concorrentes cacheando a mesma série pela primeira vez.
export async function getOrCacheSeries(env: Env, db: Db, tmdbId: number): Promise<CachedSeries> {
  const [cached] = await db.select().from(series).where(eq(series.tmdbId, tmdbId));
  if (cached) {
    return cached;
  }

  const detail = await getSeriesById(env, tmdbId);
  if (!detail) {
    throw new SeriesNotFoundError(tmdbId);
  }

  await db
    .insert(series)
    .values({
      tmdbId: detail.id,
      name: detail.name,
      posterPath: detail.poster_path ?? null,
      firstAirDate:
        detail.first_air_date && detail.first_air_date.length > 0 ? new Date(detail.first_air_date) : null,
      overview: detail.overview ?? null,
      genres: detail.genres?.map((genre) => genre.name) ?? [],
      numberOfSeasons: detail.number_of_seasons ?? null,
      numberOfEpisodes: detail.number_of_episodes ?? null,
      rating: detail.vote_average ?? null,
    })
    .onConflictDoNothing();

  const [inserted] = await db.select().from(series).where(eq(series.tmdbId, tmdbId));
  if (!inserted) {
    // Não deveria acontecer (acabamos de inserir, ou outra request concorrente
    // já tinha inserido) — só pra manter o tipo de retorno não-nulo com segurança.
    throw new SeriesNotFoundError(tmdbId);
  }
  return inserted;
}

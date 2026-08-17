import { TmdbRequestError, tmdbFetch } from "./client";
import type {
  TmdbEpisodeDetail,
  TmdbFindResponse,
  TmdbSearchResponse,
  TmdbSeasonDetail,
  TmdbSeriesDetail,
  TmdbSeriesSearchResult,
} from "./types";

export async function searchSeries(
  env: Env,
  query: string,
  limit = 20,
): Promise<TmdbSeriesSearchResult[]> {
  const safeQuery = encodeURIComponent(query.slice(0, 100));
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const response = await tmdbFetch<TmdbSearchResponse<TmdbSeriesSearchResult>>(
    env,
    `/search/tv?query=${safeQuery}&include_adult=false`,
  );
  return response.results.slice(0, safeLimit);
}

// Mesmo espírito de getPopularMovies — devolve o mesmo formato de item da
// busca (TmdbSeriesSearchResult), sem request extra.
export async function getPopularSeries(
  env: Env,
  page = 1,
): Promise<TmdbSearchResponse<TmdbSeriesSearchResult>> {
  return tmdbFetch<TmdbSearchResponse<TmdbSeriesSearchResult>>(env, `/tv/popular?page=${page}`);
}

// Resolve o id de uma série na TMDB a partir de um id de outra fonte (aqui,
// TVDB — usado pelo importador de CSV do tvtime, ver series/import.service.ts).
// null quando a TMDB não acha nenhuma série pra esse id (id inválido, ou
// série que só existe no TVDB).
export async function findSeriesByTvdbId(env: Env, tvdbId: number): Promise<number | null> {
  try {
    const response = await tmdbFetch<TmdbFindResponse>(
      env,
      `/find/${tvdbId}?external_source=tvdb_id`,
    );
    return response.tv_results[0]?.id ?? null;
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// `fetchOverviewFallback: false` (import em massa do CSV do tvtime, ver
// series.service.ts/import.service.ts) pula o 2º request de sinopse em
// inglês — mesmo racional de getMovieById: o plano Free de Workers só dá
// 10ms de CPU por invocação, e cada request a mais custa round-trip + parse
// de JSON.
export async function getSeriesById(
  env: Env,
  tmdbId: number,
  options: { fetchOverviewFallback?: boolean } = {},
): Promise<TmdbSeriesDetail | null> {
  const fetchOverviewFallback = options.fetchOverviewFallback ?? true;

  let detail: TmdbSeriesDetail;
  try {
    detail = await tmdbFetch<TmdbSeriesDetail>(env, `/tv/${tmdbId}`);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }

  if (!detail.overview && fetchOverviewFallback) {
    // Mesmo fallback de getMovieById — sem tradução pt-BR, refaz só a
    // sinopse em inglês; falha nesse segundo request não derruba o
    // detalhe que já veio certo.
    try {
      const fallback = await tmdbFetch<TmdbSeriesDetail>(env, `/tv/${tmdbId}`, "en-US");
      detail.overview = fallback.overview;
    } catch {
      // segue sem sinopse
    }
  }

  return detail;
}

// Buscado ao vivo a cada abertura de temporada, sem cache local (ver
// comentário em db/schema/series.schema.ts).
export async function getSeriesSeason(
  env: Env,
  tmdbId: number,
  seasonNumber: number,
): Promise<TmdbSeasonDetail | null> {
  try {
    return await tmdbFetch<TmdbSeasonDetail>(env, `/tv/${tmdbId}/season/${seasonNumber}`);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// Buscado ao vivo a cada abertura da página do episódio, sem cache local
// (mesmo motivo de getSeriesSeason) — já traz o `crew` completo do
// episódio, incluindo quem dirigiu especificamente ele.
export async function getSeriesEpisode(
  env: Env,
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<TmdbEpisodeDetail | null> {
  const path = `/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`;
  let detail: TmdbEpisodeDetail;
  try {
    detail = await tmdbFetch<TmdbEpisodeDetail>(env, path);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }

  if (!detail.overview) {
    // Mesmo fallback de getMovieById.
    try {
      const fallback = await tmdbFetch<TmdbEpisodeDetail>(env, path, "en-US");
      detail.overview = fallback.overview;
    } catch {
      // segue sem sinopse
    }
  }

  return detail;
}

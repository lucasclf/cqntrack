import { TmdbRequestError, tmdbFetch } from "./client";
import type {
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

export async function getSeriesById(env: Env, tmdbId: number): Promise<TmdbSeriesDetail | null> {
  try {
    return await tmdbFetch<TmdbSeriesDetail>(env, `/tv/${tmdbId}`);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
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

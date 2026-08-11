import { TmdbRequestError, tmdbFetch } from "./client";
import type { TmdbMovieDetail, TmdbMovieSearchResult, TmdbSearchResponse } from "./types";

export async function searchMovies(
  env: Env,
  query: string,
  limit = 20,
): Promise<TmdbMovieSearchResult[]> {
  const safeQuery = encodeURIComponent(query.slice(0, 100));
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const response = await tmdbFetch<TmdbSearchResponse<TmdbMovieSearchResult>>(
    env,
    `/search/movie?query=${safeQuery}&include_adult=false`,
  );
  return response.results.slice(0, safeLimit);
}

export async function getMovieById(env: Env, tmdbId: number): Promise<TmdbMovieDetail | null> {
  try {
    return await tmdbFetch<TmdbMovieDetail>(env, `/movie/${tmdbId}`);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

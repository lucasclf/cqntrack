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

// Confirmado contra a API real durante o planejamento: devolve o mesmo
// formato de item da busca (TmdbMovieSearchResult), sem request extra.
export async function getPopularMovies(env: Env, page = 1): Promise<TmdbSearchResponse<TmdbMovieSearchResult>> {
  return tmdbFetch<TmdbSearchResponse<TmdbMovieSearchResult>>(env, `/movie/popular?page=${page}`);
}

export async function getMovieById(env: Env, tmdbId: number): Promise<TmdbMovieDetail | null> {
  let detail: TmdbMovieDetail;
  try {
    detail = await tmdbFetch<TmdbMovieDetail>(env, `/movie/${tmdbId}`);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }

  if (!detail.overview) {
    // Sem tradução pt-BR cadastrada pra esse filme — refaz em inglês só
    // pra sinopse. Se esse segundo request falhar, segue com sinopse
    // vazia mesmo: não derruba um detalhe que já veio certo por causa
    // disso.
    try {
      const fallback = await tmdbFetch<TmdbMovieDetail>(env, `/movie/${tmdbId}`, "en-US");
      detail.overview = fallback.overview;
    } catch {
      // segue sem sinopse
    }
  }

  return detail;
}

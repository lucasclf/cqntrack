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

// `fetchOverviewFallback: false` (import em massa do CSV do Filmow, ver
// movies.service.ts) pula esse segundo request de propósito — o plano Free
// de Workers só dá 10ms de CPU por invocação, e cada request a mais custa
// tanto o round-trip quanto o parse do JSON de resposta. Sinopse fica vazia
// até a próxima revalidação de verdade (24h, ou antes se cast/directors
// também tiverem ficado null — ver isStale em movies.service.ts).
export async function getMovieById(
  env: Env,
  tmdbId: number,
  options: { fetchOverviewFallback?: boolean } = {},
): Promise<TmdbMovieDetail | null> {
  const fetchOverviewFallback = options.fetchOverviewFallback ?? true;

  let detail: TmdbMovieDetail;
  try {
    detail = await tmdbFetch<TmdbMovieDetail>(env, `/movie/${tmdbId}`);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }

  if (!detail.overview && fetchOverviewFallback) {
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

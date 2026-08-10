import type { SeriesSummary } from "@cqntrack/shared";
import { searchSeries as tmdbSearchSeries } from "../integrations/tmdb/series";
import { buildPosterUrl, TV_GENRE_NAMES, type TmdbSeriesSearchResult } from "../integrations/tmdb/types";

// Mapeia um resultado de busca da TMDB pro DTO exposto — numberOfSeasons/
// numberOfEpisodes ficam null aqui porque a busca não traz esse dado (só o
// detalhe de cada série traz, ver getOrCacheSeries numa etapa futura).
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

export async function searchSeriesForUser(
  env: Env,
  query: string,
  limit: number,
): Promise<SeriesSummary[]> {
  const results = await tmdbSearchSeries(env, query, limit);
  return results.map(mapTmdbSearchResultToSummary);
}

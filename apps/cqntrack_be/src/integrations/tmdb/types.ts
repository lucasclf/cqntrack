// Formato bruto retornado pela TMDB (v3 REST) — nunca exposto ao frontend
// diretamente; sempre mapeado para os DTOs de @cqntrack/shared antes de sair
// de src/series/. A busca (search/tv) devolve um subconjunto menor de campos
// que o detalhe (tv/{id}) — dois tipos separados, não um só opcional.
export interface TmdbSeriesSearchResult {
  id: number;
  name: string;
  poster_path: string | null;
  first_air_date?: string; // "YYYY-MM-DD" ou string vazia quando desconhecida
  genre_ids?: number[];
  vote_average?: number; // nota agregada da própria TMDB, 0-10
}

export interface TmdbSeriesDetail {
  id: number;
  name: string;
  poster_path: string | null;
  first_air_date?: string;
  overview?: string;
  genres?: { id: number; name: string }[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  vote_average?: number;
  // Resumo de cada temporada — já vem nesse mesmo GET /tv/{id}, sem
  // request extra. A lista de episódios em si só vem no GET de temporada
  // (ver TmdbSeasonDetail).
  seasons?: {
    season_number: number;
    name: string;
    episode_count: number;
    air_date: string | null;
    poster_path: string | null;
  }[];
}

// GET /tv/{series_id}/season/{season_number} — buscado ao vivo, sem cache
// local (ver comentário em db/schema/series.schema.ts).
export interface TmdbEpisode {
  episode_number: number;
  name: string;
  air_date: string | null;
  still_path: string | null;
}

export interface TmdbSeasonDetail {
  season_number: number;
  episodes: TmdbEpisode[];
}

export interface TmdbSearchResponse<T> {
  results: T[];
}

export type TmdbImageSize = "w185" | "w342" | "w500" | "original";

// poster_path já vem com "/" na frente (ex.: "/q1JB...jpg") — não duplicar.
export function buildPosterUrl(posterPath: string, size: TmdbImageSize = "w342"): string {
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

// A busca (search/tv) devolve só genre_ids (números) — o nome completo só
// vem no endpoint de detalhe (tv/{id}). Diferente da IGDB (Apicalypse com
// `genres.name` numa query só), a TMDB não tem esse açúcar no REST. Como a
// lista de gêneros de TV da TMDB é fixa e pequena, resolve com um mapa
// estático em vez de uma chamada extra por resultado — mantém "uma tela de
// busca = 1 request".
export const TV_GENRE_NAMES: Record<number, string> = {
  10759: "Action & Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  10762: "Kids",
  9648: "Mystery",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  37: "Western",
};

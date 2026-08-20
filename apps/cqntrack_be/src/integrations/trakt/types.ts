// Formato bruto devolvido pela API do Trakt (api.trakt.tv) — nunca exposto
// ao frontend diretamente; sempre mapeado para os DTOs de @cqntrack/shared
// antes de sair de src/movies|series/. Só os campos que o import de fato usa
// (ids.tmdb, título, temporada/episódio, nota).

export interface TraktIds {
  trakt: number;
  slug?: string;
  imdb?: string | null;
  tmdb?: number | null;
}

export interface TraktSeasonIds extends TraktIds {
  tvdb?: number | null;
}

export interface TraktWatchedMovie {
  plays: number;
  last_watched_at: string;
  movie: {
    title: string;
    year?: number;
    ids: TraktIds;
  };
}

export interface TraktWatchedEpisode {
  number: number;
  plays: number;
  last_watched_at: string;
}

export interface TraktWatchedSeason {
  number: number;
  episodes: TraktWatchedEpisode[];
}

export interface TraktWatchedShow {
  plays: number;
  last_watched_at: string;
  show: {
    title: string;
    year?: number;
    ids: TraktSeasonIds;
  };
  seasons: TraktWatchedSeason[];
}

export interface TraktMovieRating {
  rated_at: string;
  rating: number; // 1-10
  movie: {
    title: string;
    ids: TraktIds;
  };
}

export interface TraktShowRating {
  rated_at: string;
  rating: number; // 1-10
  show: {
    title: string;
    ids: TraktSeasonIds;
  };
}

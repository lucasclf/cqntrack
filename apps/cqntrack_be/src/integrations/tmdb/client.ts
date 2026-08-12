const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export class TmdbRequestError extends Error {
  constructor(
    public readonly status: number,
    body: string,
  ) {
    super(`Requisição à TMDB falhou (status ${status}): ${body}`);
    this.name = "TmdbRequestError";
  }
}

// GET com Authorization: Bearer — a TMDB usa um Read Access Token de longa
// duração (v4 auth), diferente da IGDB: não tem OAuth por client/secret, não
// precisa de cache/refresh de token em D1. Sem rate limiter dedicado também:
// a TMDB não publica um limite rígido como os 4 req/s da IGDB, e o debounce
// de 300ms no front já evita martelar a API.
//
// `language` default pt-BR — a TMDB não faz fallback de idioma sozinha: um
// título sem tradução cadastrada volta com o campo de texto (overview/
// biography) vazio, não em inglês. Quem chama e precisa de um campo de
// texto garantido refaz o request com `language: "en-US"` só quando esse
// campo vier vazio (ver getMovieById/getSeriesById/getSeriesEpisode/
// getPersonById).
export async function tmdbFetch<T>(env: Env, path: string, language = "pt-BR"): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(`${TMDB_BASE_URL}${path}${separator}language=${language}`, {
    headers: {
      Authorization: `Bearer ${env.TMDB_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new TmdbRequestError(res.status, await res.text());
  }
  return (await res.json()) as T;
}

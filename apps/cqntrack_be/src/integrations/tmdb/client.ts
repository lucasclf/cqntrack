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
export async function tmdbFetch<T>(env: Env, path: string): Promise<T> {
  const res = await fetch(`${TMDB_BASE_URL}${path}`, {
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

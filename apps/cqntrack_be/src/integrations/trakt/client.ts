import type {
  TraktMovieRating,
  TraktShowRating,
  TraktWatchedMovie,
  TraktWatchedShow,
} from "./types";

const TRAKT_BASE_URL = "https://api.trakt.tv";

// Exigido pela Trakt em toda chamada, junto com os headers de auth (ver
// docs.trakt.tv/docs/required-headers) — identifica o app, sem relação com
// o User-Agent do navegador de quem está usando o cqntrack.
const USER_AGENT = "cqntrack/1.0 (+https://tracker.cqn.xyz.br)";

export class TraktRequestError extends Error {
  constructor(
    public readonly status: number,
    body: string,
  ) {
    super(`Requisição ao Trakt falhou (status ${status}): ${body}`);
    this.name = "TraktRequestError";
  }
}

// null especificamente pra 401/403/404 — perfil privado ou username
// inexistente (a Trakt não distingue os dois com clareza pros endpoints
// "OAuth Optional" que usamos aqui, ver getWatchedMovies/getWatchedShows).
// Quem chama trata isso como "perfil indisponível" pro usuário conferir o
// username/a privacidade do histórico. Qualquer outro status (ex.:
// TRAKT_CLIENT_ID inválido, 5xx) vira TraktRequestError de verdade — não é
// um caso esperado do fluxo de import.
async function traktFetch<T>(env: Env, path: string): Promise<T | null> {
  const res = await fetch(`${TRAKT_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      "trakt-api-version": "2",
      "trakt-api-key": env.TRAKT_CLIENT_ID,
    },
  });

  if (res.status === 401 || res.status === 403 || res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new TraktRequestError(res.status, await res.text());
  }
  return (await res.json()) as T;
}

export async function getWatchedMovies(
  env: Env,
  username: string,
): Promise<TraktWatchedMovie[] | null> {
  return traktFetch<TraktWatchedMovie[]>(
    env,
    `/users/${encodeURIComponent(username)}/watched/movies`,
  );
}

export async function getWatchedShows(
  env: Env,
  username: string,
): Promise<TraktWatchedShow[] | null> {
  return traktFetch<TraktWatchedShow[]>(
    env,
    `/users/${encodeURIComponent(username)}/watched/shows`,
  );
}

export async function getMovieRatings(
  env: Env,
  username: string,
): Promise<TraktMovieRating[] | null> {
  return traktFetch<TraktMovieRating[]>(
    env,
    `/users/${encodeURIComponent(username)}/ratings/movies`,
  );
}

export async function getShowRatings(
  env: Env,
  username: string,
): Promise<TraktShowRating[] | null> {
  return traktFetch<TraktShowRating[]>(env, `/users/${encodeURIComponent(username)}/ratings/shows`);
}

// Trakt usa 1-10 inteiro; cqntrack usa 0-5 em meio-ponto (ver
// UpsertMovieEntryRequestSchema/UpsertSeriesEntryRequestSchema) — divide
// por 2 e arredonda pro 0.5 mais próximo (8 → 4.0, 7 → 3.5).
export function toCqntrackRating(traktRating: number): number {
  return Math.round((traktRating / 2) * 2) / 2;
}

import { TmdbRequestError, tmdbFetch } from "./client";
import type {
  TmdbAggregateCredits,
  TmdbCredits,
  TmdbPerson,
  TmdbPersonMovieCredits,
  TmdbPersonTvCredits,
} from "./types";

export async function getMovieCredits(env: Env, tmdbId: number): Promise<TmdbCredits | null> {
  try {
    return await tmdbFetch<TmdbCredits>(env, `/movie/${tmdbId}/credits`);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// Série não tem elenco/crew "simples" com diretor único como filme — esse
// endpoint agregado é o único jeito de saber quem dirigiu quantos episódios
// (ver comentário em TmdbAggregateCredits).
export async function getSeriesAggregateCredits(
  env: Env,
  tmdbId: number,
): Promise<TmdbAggregateCredits | null> {
  try {
    return await tmdbFetch<TmdbAggregateCredits>(env, `/tv/${tmdbId}/aggregate_credits`);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getPersonById(env: Env, personId: number): Promise<TmdbPerson | null> {
  let detail: TmdbPerson;
  try {
    detail = await tmdbFetch<TmdbPerson>(env, `/person/${personId}`);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }

  if (!detail.biography) {
    // Mesmo fallback de getMovieById, aplicado à biografia.
    try {
      const fallback = await tmdbFetch<TmdbPerson>(env, `/person/${personId}`, "en-US");
      detail.biography = fallback.biography;
    } catch {
      // segue sem biografia
    }
  }

  return detail;
}

export async function getPersonMovieCredits(
  env: Env,
  personId: number,
): Promise<TmdbPersonMovieCredits | null> {
  try {
    return await tmdbFetch<TmdbPersonMovieCredits>(env, `/person/${personId}/movie_credits`);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getPersonTvCredits(
  env: Env,
  personId: number,
): Promise<TmdbPersonTvCredits | null> {
  try {
    return await tmdbFetch<TmdbPersonTvCredits>(env, `/person/${personId}/tv_credits`);
  } catch (error) {
    if (error instanceof TmdbRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

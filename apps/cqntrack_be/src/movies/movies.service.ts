import type { CastMember, CrewMember, MovieSummary } from "@cqntrack/shared";
import { eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { movie } from "../db/schema";
import { getMovieCredits } from "../integrations/tmdb/credits";
import {
  getMovieById,
  getPopularMovies,
  searchMovies as tmdbSearchMovies,
} from "../integrations/tmdb/movies";
import {
  buildPosterUrl,
  MOVIE_GENRE_NAMES,
  type TmdbCredits,
  type TmdbMovieSearchResult,
} from "../integrations/tmdb/types";

type Db = ReturnType<typeof createDb>;
export type CachedMovie = typeof movie.$inferSelect;

export class MovieNotFoundError extends Error {
  constructor(public readonly tmdbId: number) {
    super(`Filme ${tmdbId} não encontrado na TMDB`);
    this.name = "MovieNotFoundError";
  }
}

// Campos de snapshot pra gravar na tabela genérica `activity` — mesmo
// formato de toActivitySnapshot em series.service.ts, só trocando o domínio.
export function toActivitySnapshot(cachedMovie: CachedMovie) {
  return {
    mediaType: "movies" as const,
    itemId: String(cachedMovie.tmdbId),
    itemTitle: cachedMovie.name,
    itemHref: `/filmes/${cachedMovie.tmdbId}`,
    itemCoverUrl: cachedMovie.posterPath ? buildPosterUrl(cachedMovie.posterPath, "w342") : null,
  };
}

// Mapeia um resultado de busca da TMDB pro DTO exposto — runtime fica null
// aqui porque a busca não traz esse dado (só o detalhe de cada filme traz,
// ver getOrCacheMovie).
export function mapTmdbSearchResultToSummary(result: TmdbMovieSearchResult): MovieSummary {
  return {
    tmdbId: result.id,
    name: result.title,
    posterUrl: result.poster_path ? buildPosterUrl(result.poster_path, "w342") : null,
    releaseDate: result.release_date && result.release_date.length > 0 ? result.release_date : null,
    genres: (result.genre_ids ?? [])
      .map((id) => MOVIE_GENRE_NAMES[id])
      .filter((name): name is string => Boolean(name)),
    runtime: null,
    rating: result.vote_average ?? null,
  };
}

// Mesma forma de mapTmdbSearchResultToSummary, mas a partir de uma linha já
// cacheada no D1 (movie), usada por qualquer rota que leia filmes do
// próprio banco em vez de consultar a TMDB de novo (detalhe, "meus
// filmes", listas etc.).
export function mapCachedMovieToSummary(row: CachedMovie): MovieSummary {
  return {
    tmdbId: row.tmdbId,
    name: row.name,
    posterUrl: row.posterPath ? buildPosterUrl(row.posterPath, "w342") : null,
    releaseDate: row.releaseDate ? row.releaseDate.toISOString().slice(0, 10) : null,
    genres: row.genres ?? [],
    runtime: row.runtime,
    rating: row.rating,
  };
}

// Mesma foto usada em pôster/still — w185 é o tamanho que a TMDB recomenda
// pra profile_path de pessoa (menor que o w342 de pôster de filme).
function mapCastRowToDto(entry: NonNullable<CachedMovie["cast"]>[number]): CastMember {
  return {
    personId: entry.personId,
    name: entry.name,
    character: entry.character,
    profileUrl: entry.profilePath ? buildPosterUrl(entry.profilePath, "w185") : null,
  };
}

function mapDirectorRowToDto(entry: NonNullable<CachedMovie["directors"]>[number]): CrewMember {
  return {
    personId: entry.personId,
    name: entry.name,
    profileUrl: entry.profilePath ? buildPosterUrl(entry.profilePath, "w185") : null,
  };
}

export function mapCachedMovieCast(row: CachedMovie): CastMember[] {
  return (row.cast ?? []).map(mapCastRowToDto);
}

export function mapCachedMovieDirectors(row: CachedMovie): CrewMember[] {
  return (row.directors ?? []).map(mapDirectorRowToDto);
}

export async function searchMoviesForUser(
  env: Env,
  query: string,
  limit: number,
): Promise<MovieSummary[]> {
  const results = await tmdbSearchMovies(env, query, limit);
  return results.map(mapTmdbSearchResultToSummary);
}

// Tela "Descobrir" — populares da própria TMDB. hasMore é aproximado (true
// quando a página ainda não chegou no total_pages informado pela TMDB).
export async function getPopularMoviesForUser(
  env: Env,
  page: number,
): Promise<{ results: MovieSummary[]; hasMore: boolean }> {
  const response = await getPopularMovies(env, page);
  return {
    results: response.results.map(mapTmdbSearchResultToSummary),
    hasMore: response.total_pages !== undefined && (response.page ?? page) < response.total_pages,
  };
}

// Filme já lançado não ganha "temporada nova" como série, mas a nota
// agregada da TMDB continua indo pra cima com o tempo — mesmo TTL de
// getOrCacheSeries, pelo mesmo motivo (não fica preso pra sempre no que
// foi cacheado da primeira vez).
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// cast === null (nunca chegou a buscar créditos, ver getOrCacheMovie com
// fetchCredits: false) força revalidação na próxima chamada, mesmo dentro
// da janela de 24h — senão um filme importado em massa ficaria até um dia
// inteiro sem elenco/direção na tela de detalhe.
function isStale(row: CachedMovie): boolean {
  return row.cast === null || Date.now() - row.updatedAt.getTime() > CACHE_TTL_MS;
}

// Top billed cast, mesmo espírito de qualquer site de filme — não a lista
// completa (evita payload gigante pra elenco extenso, e a página de pessoa
// já cobre "toda a carreira" de quem quiser ir mais fundo).
const MAX_CAST_MEMBERS = 10;

function mapCreditsToCastRows(credits: TmdbCredits | null) {
  if (!credits) return [];
  return [...credits.cast]
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_CAST_MEMBERS)
    .map((member) => ({
      personId: member.id,
      name: member.name,
      character: member.character,
      profilePath: member.profile_path,
    }));
}

// Quase sempre 1 pessoa, mas o crew pode listar o mesmo diretor mais de uma
// vez (créditos duplicados da própria TMDB) — dedupe por id.
function mapCreditsToDirectorRows(credits: TmdbCredits | null) {
  if (!credits) return [];
  const seen = new Set<number>();
  const directors: { personId: number; name: string; profilePath: string | null }[] = [];
  for (const member of credits.crew) {
    if (member.job !== "Director" || seen.has(member.id)) continue;
    seen.add(member.id);
    directors.push({ personId: member.id, name: member.name, profilePath: member.profile_path });
  }
  return directors;
}

function mapMovieDetailToRow(detail: NonNullable<Awaited<ReturnType<typeof getMovieById>>>) {
  return {
    name: detail.title,
    posterPath: detail.poster_path ?? null,
    releaseDate:
      detail.release_date && detail.release_date.length > 0 ? new Date(detail.release_date) : null,
    overview: detail.overview ?? null,
    genres: detail.genres?.map((genre) => genre.name) ?? [],
    runtime: detail.runtime ?? null,
    rating: detail.vote_average ?? null,
  };
}

// Busca o filme no cache local (movie); se não existir OU se o cache
// estiver velho, consulta a TMDB e grava (insert ou update) antes de
// devolver. `onConflictDoNothing` torna o insert seguro sob requests
// concorrentes cacheando o mesmo filme pela primeira vez.
//
// `fetchCredits: false` (import em massa do CSV do Filmow, ver
// import.service.ts) pula o request de elenco/direção — cada filme novo já
// bate o teto de CPU do Worker (JSON grande de créditos + sort/dedupe) num
// lote com vários filmes nunca vistos antes; o elenco fica null e backfila
// sozinho na próxima vez que alguém abrir o detalhe do filme de verdade
// (fetchCredits volta a ser true por padrão), via o isStale acima.
export async function getOrCacheMovie(
  env: Env,
  db: Db,
  tmdbId: number,
  options: { fetchCredits?: boolean; fetchOverviewFallback?: boolean } = {},
): Promise<CachedMovie> {
  const fetchCredits = options.fetchCredits ?? true;

  const [cached] = await db.select().from(movie).where(eq(movie.tmdbId, tmdbId));
  if (cached && !isStale(cached)) {
    return cached;
  }

  const detail = await getMovieById(env, tmdbId, {
    fetchOverviewFallback: options.fetchOverviewFallback,
  });
  if (!detail) {
    // TMDB indisponível ou filme removido de lá — melhor devolver o cache
    // velho (se existir) do que quebrar a tela por causa da revalidação.
    if (cached) {
      return cached;
    }
    throw new MovieNotFoundError(tmdbId);
  }

  // Elenco/direção vêm de um request separado — se falhar, não derruba a
  // revalidação do filme em si, só fica sem cast/directors até a próxima
  // janela de 24h. fetchCredits: false pula esse request de propósito (ver
  // comentário acima) — nesse caso cast/directors ficam de fora do payload
  // (em vez de virarem `[]`), pra um update não apagar elenco que já
  // tinha sido buscado antes, e um insert novo ficar com a coluna null
  // (== "nunca buscou", ver isStale) em vez de "buscou e não achou ninguém".
  const baseValues = mapMovieDetailToRow(detail);
  let values: typeof baseValues & {
    cast?: ReturnType<typeof mapCreditsToCastRows>;
    directors?: ReturnType<typeof mapCreditsToDirectorRows>;
  } = baseValues;

  if (fetchCredits) {
    const credits = await getMovieCredits(env, tmdbId).catch(() => null);
    values = {
      ...baseValues,
      cast: mapCreditsToCastRows(credits),
      directors: mapCreditsToDirectorRows(credits),
    };
  }

  if (cached) {
    await db.update(movie).set(values).where(eq(movie.tmdbId, tmdbId));
  } else {
    await db
      .insert(movie)
      .values({ tmdbId: detail.id, ...values })
      .onConflictDoNothing();
  }

  const [row] = await db.select().from(movie).where(eq(movie.tmdbId, tmdbId));
  if (!row) {
    // Não deveria acontecer (acabamos de inserir, ou outra request concorrente
    // já tinha inserido) — só pra manter o tipo de retorno não-nulo com segurança.
    throw new MovieNotFoundError(tmdbId);
  }
  return row;
}

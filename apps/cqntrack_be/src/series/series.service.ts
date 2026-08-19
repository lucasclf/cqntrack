import type { CastMember, CrewMember, SeriesDirector, SeriesSummary } from "@cqntrack/shared";
import { eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { series } from "../db/schema";
import type { CachedSeriesUpcomingEpisode } from "../db/schema/series.schema";
import { getSeriesAggregateCredits } from "../integrations/tmdb/credits";
import {
  getPopularSeries,
  getSeriesById,
  searchSeries as tmdbSearchSeries,
} from "../integrations/tmdb/series";
import {
  buildPosterUrl,
  TV_GENRE_NAMES,
  type TmdbAggregateCredits,
  type TmdbSeriesSearchResult,
  type TmdbUpcomingEpisode,
} from "../integrations/tmdb/types";

type Db = ReturnType<typeof createDb>;
export type CachedSeries = typeof series.$inferSelect;

export class SeriesNotFoundError extends Error {
  constructor(public readonly tmdbId: number) {
    super(`Série ${tmdbId} não encontrada na TMDB`);
    this.name = "SeriesNotFoundError";
  }
}

// Campos de snapshot pra gravar na tabela genérica `activity` — mesmo
// formato de toActivitySnapshot em games.service.ts, só trocando o domínio.
export function toActivitySnapshot(cachedSeries: CachedSeries) {
  return {
    mediaType: "series" as const,
    itemId: String(cachedSeries.tmdbId),
    itemTitle: cachedSeries.name,
    itemHref: `/series/${cachedSeries.tmdbId}`,
    itemCoverUrl: cachedSeries.posterPath ? buildPosterUrl(cachedSeries.posterPath, "w342") : null,
  };
}

// Mapeia um resultado de busca da TMDB pro DTO exposto — numberOfSeasons/
// numberOfEpisodes ficam null aqui porque a busca não traz esse dado (só o
// detalhe de cada série traz, ver getOrCacheSeries).
export function mapTmdbSearchResultToSummary(result: TmdbSeriesSearchResult): SeriesSummary {
  return {
    tmdbId: result.id,
    name: result.name,
    posterUrl: result.poster_path ? buildPosterUrl(result.poster_path, "w342") : null,
    firstAirDate:
      result.first_air_date && result.first_air_date.length > 0 ? result.first_air_date : null,
    genres: (result.genre_ids ?? [])
      .map((id) => TV_GENRE_NAMES[id])
      .filter((name): name is string => Boolean(name)),
    numberOfSeasons: null,
    numberOfEpisodes: null,
    seasons: null,
    rating: result.vote_average ?? null,
  };
}

// Mesma forma de mapTmdbSearchResultToSummary, mas a partir de uma linha já
// cacheada no D1 (series), usada por qualquer rota que leia séries do
// próprio banco em vez de consultar a TMDB de novo (detalhe, "minhas
// séries", listas etc.).
export function mapCachedSeriesToSummary(row: CachedSeries): SeriesSummary {
  return {
    tmdbId: row.tmdbId,
    name: row.name,
    posterUrl: row.posterPath ? buildPosterUrl(row.posterPath, "w342") : null,
    firstAirDate: row.firstAirDate ? row.firstAirDate.toISOString().slice(0, 10) : null,
    genres: row.genres ?? [],
    numberOfSeasons: row.numberOfSeasons,
    numberOfEpisodes: row.numberOfEpisodes,
    seasons:
      row.seasons?.map((season) => ({
        seasonNumber: season.seasonNumber,
        name: season.name,
        episodeCount: season.episodeCount,
        airDate: season.airDate,
        posterUrl: season.posterPath ? buildPosterUrl(season.posterPath, "w185") : null,
      })) ?? null,
    rating: row.rating,
  };
}

// Mesmo tamanho de foto usado pra elenco/direção de filme (w185).
function mapCastRowToDto(entry: NonNullable<CachedSeries["cast"]>[number]): CastMember {
  return {
    personId: entry.personId,
    name: entry.name,
    character: entry.character,
    profileUrl: entry.profilePath ? buildPosterUrl(entry.profilePath, "w185") : null,
  };
}

function mapCrewRowToDto(entry: {
  personId: number;
  name: string;
  profilePath: string | null;
}): CrewMember {
  return {
    personId: entry.personId,
    name: entry.name,
    profileUrl: entry.profilePath ? buildPosterUrl(entry.profilePath, "w185") : null,
  };
}

export function mapCachedSeriesCast(row: CachedSeries): CastMember[] {
  return (row.cast ?? []).map(mapCastRowToDto);
}

export function mapCachedSeriesCreators(row: CachedSeries): CrewMember[] {
  return (row.creators ?? []).map(mapCrewRowToDto);
}

export function mapCachedSeriesDirectors(row: CachedSeries): SeriesDirector[] {
  return (row.directors ?? []).map((entry) => ({
    ...mapCrewRowToDto(entry),
    episodeCount: entry.episodeCount,
  }));
}

export async function searchSeriesForUser(
  env: Env,
  query: string,
  limit: number,
): Promise<SeriesSummary[]> {
  const results = await tmdbSearchSeries(env, query, limit);
  return results.map(mapTmdbSearchResultToSummary);
}

// Tela "Descobrir" — populares da própria TMDB. Mesmo espírito de
// getPopularMoviesForUser (filme).
export async function getPopularSeriesForUser(
  env: Env,
  page: number,
): Promise<{ results: SeriesSummary[]; hasMore: boolean }> {
  const response = await getPopularSeries(env, page);
  return {
    results: response.results.map(mapTmdbSearchResultToSummary),
    hasMore: response.total_pages !== undefined && (response.page ?? page) < response.total_pages,
  };
}

// Séries em exibição ganham temporada nova (ou episódios novos numa
// temporada já existente) com o tempo — sem expirar, `series.seasons`/
// `numberOfSeasons`/`numberOfEpisodes` ficariam congelados na primeira vez
// que alguém abriu a série. 24h porque isso não muda mais de uma vez por
// dia nem em série semanal, e evita rechecar a TMDB a cada abertura de tela.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// cast === null (nunca chegou a buscar créditos, ver getOrCacheSeries com
// fetchCredits: false) força revalidação na próxima chamada, mesmo dentro
// da janela de 24h — senão uma série importada em massa ficaria até um dia
// inteiro sem elenco/direção na tela de detalhe. Mesmo padrão de
// movies.service.ts.
function isStale(row: CachedSeries): boolean {
  return row.cast === null || Date.now() - row.updatedAt.getTime() > CACHE_TTL_MS;
}

// Top billed cast, mesmo espírito de filme — não a lista completa (evita
// payload gigante em séries longas; a página de pessoa cobre a carreira
// inteira de quem quiser ir mais fundo).
const MAX_CAST_MEMBERS = 10;
// Série longa pode ter dezenas de diretores diferentes — top 5 por número
// de episódios dirigidos, não a lista inteira.
const MAX_DIRECTORS = 5;

function mapAggregateCreditsToCastRows(credits: TmdbAggregateCredits | null) {
  if (!credits) return [];
  return [...credits.cast]
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_CAST_MEMBERS)
    .map((member) => ({
      personId: member.id,
      name: member.name,
      character: member.roles[0]?.character ?? "",
      profilePath: member.profile_path,
    }));
}

// "Diretor" de série não é um crédito único como em filme — cada membro do
// crew tem um array `jobs[]` com a contagem de episódios por job. Filtra
// quem tem algum job "Director", soma os episódios desse job específico
// (uma pessoa não aparece duas vezes no array — já vem uma linha por
// pessoa), ordena por quem dirigiu mais episódios e corta no top 5.
function mapAggregateCreditsToDirectorRows(credits: TmdbAggregateCredits | null) {
  if (!credits) return [];
  return credits.crew
    .map((member) => ({
      member,
      directorJob: member.jobs.find((job) => job.job === "Director"),
    }))
    .filter(
      (
        entry,
      ): entry is {
        member: (typeof credits.crew)[number];
        directorJob: { job: string; episode_count: number };
      } => entry.directorJob !== undefined,
    )
    .sort((a, b) => b.directorJob.episode_count - a.directorJob.episode_count)
    .slice(0, MAX_DIRECTORS)
    .map(({ member, directorJob }) => ({
      personId: member.id,
      name: member.name,
      profilePath: member.profile_path,
      episodeCount: directorJob.episode_count,
    }));
}

// null quando a TMDB não informa data (ex.: episódio "TBA") — mesmo sem
// data, não dá pra usar como "disponível"/"previsto" (ver
// entries.service.ts), então esses casos viram null aqui também.
function mapUpcomingEpisode(
  episode: TmdbUpcomingEpisode | null | undefined,
): CachedSeriesUpcomingEpisode | null {
  if (!episode || !episode.air_date) {
    return null;
  }
  return {
    seasonNumber: episode.season_number,
    episodeNumber: episode.episode_number,
    name: episode.name,
    airDate: episode.air_date,
  };
}

function mapSeriesDetailToRow(detail: NonNullable<Awaited<ReturnType<typeof getSeriesById>>>) {
  return {
    name: detail.name,
    posterPath: detail.poster_path ?? null,
    firstAirDate:
      detail.first_air_date && detail.first_air_date.length > 0
        ? new Date(detail.first_air_date)
        : null,
    overview: detail.overview ?? null,
    genres: detail.genres?.map((genre) => genre.name) ?? [],
    numberOfSeasons: detail.number_of_seasons ?? null,
    numberOfEpisodes: detail.number_of_episodes ?? null,
    seasons:
      detail.seasons?.map((season) => ({
        seasonNumber: season.season_number,
        name: season.name,
        episodeCount: season.episode_count,
        airDate: season.air_date && season.air_date.length > 0 ? season.air_date : null,
        posterPath: season.poster_path ?? null,
      })) ?? [],
    // `creators` não depende do request de créditos (vem de graça do
    // próprio `detail.created_by`) — sempre incluído, diferente de
    // cast/directors abaixo.
    creators:
      detail.created_by?.map((creator) => ({
        personId: creator.id,
        name: creator.name,
        profilePath: creator.profile_path,
      })) ?? [],
    rating: detail.vote_average ?? null,
    nextEpisodeToAir: mapUpcomingEpisode(detail.next_episode_to_air),
    lastEpisodeToAir: mapUpcomingEpisode(detail.last_episode_to_air),
  };
}

// Busca a série no cache local (series); se não existir OU se o cache
// estiver velho, consulta a TMDB e grava (insert ou update) antes de
// devolver. `onConflictDoNothing` torna o insert seguro sob requests
// concorrentes cacheando a mesma série pela primeira vez.
//
// `fetchCredits: false` (import em massa do CSV do tvtime, ver
// import.service.ts) pula o request de elenco/direção — cada série nova já
// bate o teto de CPU do Worker (JSON grande de aggregate_credits) num lote
// com várias séries nunca vistas antes; o elenco fica null e backfila
// sozinho na próxima vez que alguém abrir o detalhe da série de verdade
// (fetchCredits volta a ser true por padrão), via o isStale acima.
export async function getOrCacheSeries(
  env: Env,
  db: Db,
  tmdbId: number,
  options: { fetchCredits?: boolean; fetchOverviewFallback?: boolean } = {},
): Promise<CachedSeries> {
  const fetchCredits = options.fetchCredits ?? true;

  const [cached] = await db.select().from(series).where(eq(series.tmdbId, tmdbId));
  if (cached && !isStale(cached)) {
    return cached;
  }

  const detail = await getSeriesById(env, tmdbId, {
    fetchOverviewFallback: options.fetchOverviewFallback,
  });
  if (!detail) {
    // TMDB indisponível ou série removida de lá — melhor devolver o cache
    // velho (se existir) do que quebrar a tela por causa da revalidação.
    if (cached) {
      return cached;
    }
    throw new SeriesNotFoundError(tmdbId);
  }

  // Elenco/direção vêm de um request separado — se falhar, não derruba a
  // revalidação da série em si, só fica sem cast/directors até a próxima
  // janela de 24h. `fetchCredits: false` pula esse request de propósito
  // (ver comentário acima) — nesse caso cast/directors ficam de fora do
  // payload (em vez de virarem `[]`), pra um update não apagar elenco que
  // já tinha sido buscado antes, e um insert novo ficar com a coluna null
  // (== "nunca buscou", ver isStale) em vez de "buscou e não achou ninguém".
  const baseValues = mapSeriesDetailToRow(detail);
  let values: typeof baseValues & {
    cast?: ReturnType<typeof mapAggregateCreditsToCastRows>;
    directors?: ReturnType<typeof mapAggregateCreditsToDirectorRows>;
  } = baseValues;

  if (fetchCredits) {
    const credits = await getSeriesAggregateCredits(env, tmdbId).catch(() => null);
    values = {
      ...baseValues,
      cast: mapAggregateCreditsToCastRows(credits),
      directors: mapAggregateCreditsToDirectorRows(credits),
    };
  }

  if (cached) {
    await db.update(series).set(values).where(eq(series.tmdbId, tmdbId));
  } else {
    await db
      .insert(series)
      .values({ tmdbId: detail.id, ...values })
      .onConflictDoNothing();
  }

  const [row] = await db.select().from(series).where(eq(series.tmdbId, tmdbId));
  if (!row) {
    // Não deveria acontecer (acabamos de inserir, ou outra request concorrente
    // já tinha inserido) — só pra manter o tipo de retorno não-nulo com segurança.
    throw new SeriesNotFoundError(tmdbId);
  }
  return row;
}

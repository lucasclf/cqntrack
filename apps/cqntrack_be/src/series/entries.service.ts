import type {
  ListSeriesEntriesQuery,
  RecentlyWatchedSeriesItem,
  SeriesEntry,
  SeriesEntryWithSeries,
  UpsertSeriesEntryRequest,
} from "@cqntrack/shared";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, series, seriesEntry, seriesEpisodeWatch } from "../db/schema";
import { withoutUndefined } from "../lib/without-undefined";
import {
  type CachedSeries,
  getOrCacheSeries,
  mapCachedSeriesToSummary,
  toActivitySnapshot,
} from "./series.service";

type Db = ReturnType<typeof createDb>;
type SeriesEntryRow = typeof seriesEntry.$inferSelect;

const SORT_COLUMNS = {
  rating: seriesEntry.rating,
  favorite: seriesEntry.favoritedAt,
  updatedAt: seriesEntry.updatedAt,
} as const;

interface WatchedSummary {
  count: number;
  // Chaveado por "temporada-episódio" — permite checar se um episódio
  // específico (lastEpisodeToAir da série) já foi assistido, sem query
  // extra por série (ver toSeriesEntry).
  watchedKeys: Set<string>;
}

function episodeKey(seasonNumber: number, episodeNumber: number): string {
  return `${seasonNumber}-${episodeNumber}`;
}

const EMPTY_WATCHED_SUMMARY: WatchedSummary = { count: 0, watchedKeys: new Set() };

// Uma query em lote por (temporada, episódio) — mesmo espírito de
// withItemCount em lists.service.ts, evita N+1 em listSeriesEntries. Troca
// count(*) por trazer as linhas: além da contagem, dá pra checar se um
// episódio específico já foi assistido (aviso de "episódio disponível").
async function getWatchedSummaries(
  db: Db,
  userId: string,
  seriesIds: number[],
): Promise<Map<number, WatchedSummary>> {
  if (seriesIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      seriesId: seriesEpisodeWatch.seriesId,
      seasonNumber: seriesEpisodeWatch.seasonNumber,
      episodeNumber: seriesEpisodeWatch.episodeNumber,
    })
    .from(seriesEpisodeWatch)
    .where(
      and(eq(seriesEpisodeWatch.userId, userId), inArray(seriesEpisodeWatch.seriesId, seriesIds)),
    );

  const summaries = new Map<number, WatchedSummary>();
  for (const row of rows) {
    const summary = summaries.get(row.seriesId) ?? { count: 0, watchedKeys: new Set<string>() };
    summary.count += 1;
    summary.watchedKeys.add(episodeKey(row.seasonNumber, row.episodeNumber));
    summaries.set(row.seriesId, summary);
  }
  return summaries;
}

async function getWatchedSummary(
  db: Db,
  userId: string,
  seriesId: number,
): Promise<WatchedSummary> {
  const summaries = await getWatchedSummaries(db, userId, [seriesId]);
  return summaries.get(seriesId) ?? EMPTY_WATCHED_SUMMARY;
}

// lastEpisodeToAir/nextEpisodeToAir vêm do cache global da série (ver
// series.schema.ts), refeitos pelo cron diário (refresh-episodes.job.ts)
// e a cada revalidação de 24h do cache (series.service.ts) — aqui só
// cruza com o que esse usuário específico já assistiu.
function toSeriesEntry(
  row: SeriesEntryRow,
  cachedSeries: CachedSeries,
  watched: WatchedSummary,
): SeriesEntry {
  const lastEpisode = cachedSeries.lastEpisodeToAir;
  const availableEpisode =
    lastEpisode &&
    !watched.watchedKeys.has(episodeKey(lastEpisode.seasonNumber, lastEpisode.episodeNumber))
      ? lastEpisode
      : null;

  const nextEpisode = cachedSeries.nextEpisodeToAir;
  const upcomingEpisode =
    nextEpisode && new Date(nextEpisode.airDate).getTime() > Date.now() ? nextEpisode : null;

  return {
    id: row.id,
    rating: row.rating,
    watchedEpisodeCount: watched.count,
    favoritedAt: row.favoritedAt?.toISOString() ?? null,
    abandonedAt: row.abandonedAt?.toISOString() ?? null,
    review: row.review,
    updatedAt: row.updatedAt.toISOString(),
    availableEpisode,
    upcomingEpisode,
  };
}

async function logSeriesEntryActivities(
  db: Db,
  userId: string,
  cachedSeries: CachedSeries,
  input: UpsertSeriesEntryRequest,
): Promise<void> {
  const snapshot = toActivitySnapshot(cachedSeries);
  const activities: (typeof activity.$inferInsert)[] = [];

  if (input.rating !== undefined && input.rating !== null) {
    activities.push({ userId, ...snapshot, type: "rated", metadata: { rating: input.rating } });
  }
  if (input.review !== undefined && input.review !== null && input.review.trim() !== "") {
    activities.push({ userId, ...snapshot, type: "reviewed" });
  }
  // Só ao favoritar — desfavoritar não vira atividade.
  if (input.favorited === true) {
    activities.push({ userId, ...snapshot, type: "favorited" });
  }

  if (activities.length > 0) {
    await db.insert(activity).values(activities);
  }
}

// Descobre a próxima temporada com episódios não assistidos, olhando só o
// banco (sem TMDB) — compara a contagem de watch por temporada com o
// episodeCount já cacheado em `series.seasons`. Usada pra abrir a tela de
// detalhe já na temporada certa (ver SeriesDetail/SeriesEpisodeList no FE)
// em vez de sempre cair na Temporada 1, mesmo com temporadas inteiras já
// vistas. null quando tudo já foi assistido.
export async function getNextSeasonToWatch(
  db: Db,
  userId: string,
  tmdbId: number,
  seasons: { seasonNumber: number; episodeCount: number }[],
): Promise<number | null> {
  const rows = await db
    .select({ seasonNumber: seriesEpisodeWatch.seasonNumber, count: sql<number>`count(*)` })
    .from(seriesEpisodeWatch)
    .where(and(eq(seriesEpisodeWatch.userId, userId), eq(seriesEpisodeWatch.seriesId, tmdbId)))
    .groupBy(seriesEpisodeWatch.seasonNumber);

  const watchedBySeason = new Map(rows.map((row) => [row.seasonNumber, Number(row.count)]));

  const nextSeason = [...seasons]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .find(
      (season) =>
        season.episodeCount > 0 &&
        (watchedBySeason.get(season.seasonNumber) ?? 0) < season.episodeCount,
    );

  return nextSeason?.seasonNumber ?? null;
}

export async function getSeriesEntryForUser(
  db: Db,
  userId: string,
  tmdbId: number,
): Promise<SeriesEntry | null> {
  const row = await db.query.seriesEntry.findFirst({
    where: and(eq(seriesEntry.userId, userId), eq(seriesEntry.seriesId, tmdbId)),
    with: { series: true },
  });
  if (!row) {
    return null;
  }
  const watched = await getWatchedSummary(db, userId, tmdbId);
  return toSeriesEntry(row, row.series, watched);
}

// Garante que existe uma marcação (mesmo vazia) pra essa série — usado por
// interações que não passam por upsertSeriesEntry (favoritar já tinha seu
// próprio caminho; assistir um episódio, ver episodes.service.ts, também
// precisa que a série "apareça" em listSeriesEntries mesmo sem nota/review).
// `options` repassado pra getOrCacheSeries — import em massa (ver
// series/import.service.ts) usa fetchCredits/fetchOverviewFallback: false.
export async function ensureSeriesEntry(
  env: Env,
  db: Db,
  userId: string,
  tmdbId: number,
  options: { fetchCredits?: boolean; fetchOverviewFallback?: boolean } = {},
): Promise<{ cachedSeries: CachedSeries; row: SeriesEntryRow }> {
  const cachedSeries = await getOrCacheSeries(env, db, tmdbId, options);
  const existing = await db.query.seriesEntry.findFirst({
    where: and(eq(seriesEntry.userId, userId), eq(seriesEntry.seriesId, tmdbId)),
  });
  if (existing) {
    return { cachedSeries, row: existing };
  }
  const [row] = await db.insert(seriesEntry).values({ userId, seriesId: tmdbId }).returning();
  if (!row) {
    throw new Error("Falha ao criar a marcação da série");
  }
  return { cachedSeries, row };
}

export async function upsertSeriesEntry(
  env: Env,
  db: Db,
  userId: string,
  tmdbId: number,
  input: UpsertSeriesEntryRequest,
): Promise<SeriesEntry> {
  const cachedSeries = await getOrCacheSeries(env, db, tmdbId); // garante que a FK seriesId existe

  const existing = await db.query.seriesEntry.findFirst({
    where: and(eq(seriesEntry.userId, userId), eq(seriesEntry.seriesId, tmdbId)),
  });

  const patch = withoutUndefined({
    rating: input.rating,
    review: input.review,
    favoritedAt: input.favorited === undefined ? undefined : input.favorited ? new Date() : null,
    abandonedAt: input.abandoned === undefined ? undefined : input.abandoned ? new Date() : null,
  });

  const [row] = existing
    ? await db.update(seriesEntry).set(patch).where(eq(seriesEntry.id, existing.id)).returning()
    : await db
        .insert(seriesEntry)
        .values({ userId, seriesId: tmdbId, ...patch })
        .returning();

  if (!row) {
    throw new Error("Falha ao gravar a marcação da série");
  }

  await logSeriesEntryActivities(db, userId, cachedSeries, input);

  const watched = await getWatchedSummary(db, userId, tmdbId);
  return toSeriesEntry(row, cachedSeries, watched);
}

// Sem limite de quantidade — toda série com favoritedAt preenchido, mais
// recente primeiro.
export async function getFavorites(db: Db, userId: string): Promise<SeriesEntryWithSeries[]> {
  const rows = await db.query.seriesEntry.findMany({
    where: and(eq(seriesEntry.userId, userId), isNotNull(seriesEntry.favoritedAt)),
    orderBy: desc(seriesEntry.favoritedAt),
    with: { series: true },
  });
  const watchedSummaries = await getWatchedSummaries(
    db,
    userId,
    rows.map((row) => row.seriesId),
  );

  return rows.map((row) => ({
    ...toSeriesEntry(row, row.series, watchedSummaries.get(row.seriesId) ?? EMPTY_WATCHED_SUMMARY),
    series: mapCachedSeriesToSummary(row.series),
  }));
}

// Série não tem status pra filtrar "recente" (diferente de filme/livro/
// jogo) — usa o episódio assistido mais recentemente como sinal, agregando
// MAX(watchedAt) por série em series_episode_watch. Paginado: usado tanto
// pela seção "Assistido recentemente" do perfil (pageSize=12) quanto pela
// listagem completa de "séries acompanhadas" (clicável a partir da
// estatística do perfil — sem filtro de status, série não tem esse campo).
export async function getRecentlyWatchedSeries(
  db: Db,
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ items: RecentlyWatchedSeriesItem[]; total: number }> {
  const [rows, countResult] = await Promise.all([
    db
      .select({
        seriesId: seriesEpisodeWatch.seriesId,
        lastWatchedAt: sql<number>`max(${seriesEpisodeWatch.watchedAt})`,
      })
      .from(seriesEpisodeWatch)
      .where(eq(seriesEpisodeWatch.userId, userId))
      .groupBy(seriesEpisodeWatch.seriesId)
      .orderBy(desc(sql`max(${seriesEpisodeWatch.watchedAt})`))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(distinct ${seriesEpisodeWatch.seriesId})` })
      .from(seriesEpisodeWatch)
      .where(eq(seriesEpisodeWatch.userId, userId)),
  ]);
  const total = countResult[0]?.count ?? 0;

  if (rows.length === 0) {
    return { items: [], total };
  }

  const seriesRows = await db.query.series.findMany({
    where: inArray(
      series.tmdbId,
      rows.map((row) => row.seriesId),
    ),
  });
  const byId = new Map(seriesRows.map((row) => [row.tmdbId, row]));

  const items = rows.flatMap((row) => {
    const cachedSeries = byId.get(row.seriesId);
    if (!cachedSeries) {
      return [];
    }
    return [
      {
        series: mapCachedSeriesToSummary(cachedSeries),
        lastWatchedAt: new Date(row.lastWatchedAt).toISOString(),
      },
    ];
  });

  return { items, total };
}

export async function deleteSeriesEntry(db: Db, userId: string, tmdbId: number): Promise<void> {
  await db
    .delete(seriesEntry)
    .where(and(eq(seriesEntry.userId, userId), eq(seriesEntry.seriesId, tmdbId)));
}

export async function listSeriesEntries(
  db: Db,
  userId: string,
  query: ListSeriesEntriesQuery,
): Promise<{ items: SeriesEntryWithSeries[]; total: number }> {
  const conditions = [eq(seriesEntry.userId, userId)];
  if (query.favorite !== undefined) {
    conditions.push(
      query.favorite ? isNotNull(seriesEntry.favoritedAt) : isNull(seriesEntry.favoritedAt),
    );
  }
  const where = and(...conditions);

  const sortColumn = SORT_COLUMNS[query.sortBy];
  const orderBy = query.order === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [rows, countResult] = await Promise.all([
    db.query.seriesEntry.findMany({
      where,
      orderBy,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      with: { series: true },
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(seriesEntry)
      .where(where),
  ]);

  const watchedSummaries = await getWatchedSummaries(
    db,
    userId,
    rows.map((row) => row.seriesId),
  );

  return {
    items: rows.map((row) => ({
      ...toSeriesEntry(
        row,
        row.series,
        watchedSummaries.get(row.seriesId) ?? EMPTY_WATCHED_SUMMARY,
      ),
      series: mapCachedSeriesToSummary(row.series),
    })),
    total: countResult[0]?.count ?? 0,
  };
}

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

async function getWatchedCount(db: Db, userId: string, seriesId: number): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(seriesEpisodeWatch)
    .where(and(eq(seriesEpisodeWatch.userId, userId), eq(seriesEpisodeWatch.seriesId, seriesId)));
  return result?.count ?? 0;
}

// Uma query em lote (GROUP BY) em vez de uma por linha — mesmo espírito de
// withItemCount em lists.service.ts, evita N+1 em listSeriesEntries.
async function getWatchedCounts(
  db: Db,
  userId: string,
  seriesIds: number[],
): Promise<Map<number, number>> {
  if (seriesIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({ seriesId: seriesEpisodeWatch.seriesId, count: sql<number>`count(*)` })
    .from(seriesEpisodeWatch)
    .where(
      and(eq(seriesEpisodeWatch.userId, userId), inArray(seriesEpisodeWatch.seriesId, seriesIds)),
    )
    .groupBy(seriesEpisodeWatch.seriesId);
  return new Map(rows.map((row) => [row.seriesId, row.count]));
}

function toSeriesEntry(row: SeriesEntryRow, watchedEpisodeCount: number): SeriesEntry {
  return {
    id: row.id,
    rating: row.rating,
    watchedEpisodeCount,
    favoritedAt: row.favoritedAt?.toISOString() ?? null,
    review: row.review,
    updatedAt: row.updatedAt.toISOString(),
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

export async function getSeriesEntryForUser(
  db: Db,
  userId: string,
  tmdbId: number,
): Promise<SeriesEntry | null> {
  const row = await db.query.seriesEntry.findFirst({
    where: and(eq(seriesEntry.userId, userId), eq(seriesEntry.seriesId, tmdbId)),
  });
  if (!row) {
    return null;
  }
  const watchedEpisodeCount = await getWatchedCount(db, userId, tmdbId);
  return toSeriesEntry(row, watchedEpisodeCount);
}

// Garante que existe uma marcação (mesmo vazia) pra essa série — usado por
// interações que não passam por upsertSeriesEntry (favoritar já tinha seu
// próprio caminho; assistir um episódio, ver episodes.service.ts, também
// precisa que a série "apareça" em listSeriesEntries mesmo sem nota/review).
export async function ensureSeriesEntry(
  env: Env,
  db: Db,
  userId: string,
  tmdbId: number,
): Promise<{ cachedSeries: CachedSeries; row: SeriesEntryRow }> {
  const cachedSeries = await getOrCacheSeries(env, db, tmdbId);
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

  const watchedEpisodeCount = await getWatchedCount(db, userId, tmdbId);
  return toSeriesEntry(row, watchedEpisodeCount);
}

// Sem limite de quantidade — toda série com favoritedAt preenchido, mais
// recente primeiro.
export async function getFavorites(db: Db, userId: string): Promise<SeriesEntryWithSeries[]> {
  const rows = await db.query.seriesEntry.findMany({
    where: and(eq(seriesEntry.userId, userId), isNotNull(seriesEntry.favoritedAt)),
    orderBy: desc(seriesEntry.favoritedAt),
    with: { series: true },
  });
  const watchedCounts = await getWatchedCounts(
    db,
    userId,
    rows.map((row) => row.seriesId),
  );

  return rows.map((row) => ({
    ...toSeriesEntry(row, watchedCounts.get(row.seriesId) ?? 0),
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
    conditions.push(query.favorite ? isNotNull(seriesEntry.favoritedAt) : isNull(seriesEntry.favoritedAt));
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

  const watchedCounts = await getWatchedCounts(
    db,
    userId,
    rows.map((row) => row.seriesId),
  );

  return {
    items: rows.map((row) => ({
      ...toSeriesEntry(row, watchedCounts.get(row.seriesId) ?? 0),
      series: mapCachedSeriesToSummary(row.series),
    })),
    total: countResult[0]?.count ?? 0,
  };
}

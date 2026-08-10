import type {
  ListSeriesEntriesQuery,
  SeriesEntry,
  SeriesEntryWithSeries,
  UpsertSeriesEntryRequest,
} from "@cqntrack/shared";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, seriesEntry } from "../db/schema";
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
  status: seriesEntry.status,
  rating: seriesEntry.rating,
  favorite: seriesEntry.favoriteSlot,
  updatedAt: seriesEntry.updatedAt,
} as const;

function toSeriesEntry(row: SeriesEntryRow): SeriesEntry {
  return {
    id: row.id,
    status: row.status,
    rating: row.rating,
    currentSeason: row.currentSeason,
    currentEpisode: row.currentEpisode,
    favoriteSlot: row.favoriteSlot as SeriesEntry["favoriteSlot"],
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

  // Só loga quando um status real é definido — desmarcar (status: null),
  // como desfavoritar, não vira atividade no feed.
  if (input.status !== undefined && input.status !== null) {
    activities.push({ userId, ...snapshot, type: "status_changed", metadata: { status: input.status } });
  }
  if (input.rating !== undefined && input.rating !== null) {
    activities.push({ userId, ...snapshot, type: "rated", metadata: { rating: input.rating } });
  }
  if (input.review !== undefined && input.review !== null && input.review.trim() !== "") {
    activities.push({ userId, ...snapshot, type: "reviewed" });
  }
  // Tipo de atividade novo, só faz sentido pra séries — jogos não tem
  // progresso por temporada/episódio.
  if (
    (input.currentSeason !== undefined && input.currentSeason !== null) ||
    (input.currentEpisode !== undefined && input.currentEpisode !== null)
  ) {
    activities.push({
      userId,
      ...snapshot,
      type: "progress_updated",
      metadata: { season: input.currentSeason ?? null, episode: input.currentEpisode ?? null },
    });
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
  return row ? toSeriesEntry(row) : null;
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
    status: input.status,
    rating: input.rating,
    currentSeason: input.currentSeason,
    currentEpisode: input.currentEpisode,
    review: input.review,
  });

  const [row] = existing
    ? await db.update(seriesEntry).set(patch).where(eq(seriesEntry.id, existing.id)).returning()
    : await db.insert(seriesEntry).values({ userId, seriesId: tmdbId, ...patch }).returning();

  if (!row) {
    throw new Error("Falha ao gravar a marcação da série");
  }

  await logSeriesEntryActivities(db, userId, cachedSeries, input);

  return toSeriesEntry(row);
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
  if (query.status) {
    conditions.push(eq(seriesEntry.status, query.status));
  }
  if (query.favorite !== undefined) {
    conditions.push(
      query.favorite ? isNotNull(seriesEntry.favoriteSlot) : isNull(seriesEntry.favoriteSlot),
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
    db.select({ count: sql<number>`count(*)` }).from(seriesEntry).where(where),
  ]);

  return {
    items: rows.map((row) => ({
      ...toSeriesEntry(row),
      series: mapCachedSeriesToSummary(row.series),
    })),
    total: countResult[0]?.count ?? 0,
  };
}

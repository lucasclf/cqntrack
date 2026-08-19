import type { ContinueWatchingItem } from "@cqntrack/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { seriesEpisodeWatch, seriesWatchProgress } from "../db/schema";
import { mapCachedSeriesToSummary } from "./series.service";

type Db = ReturnType<typeof createDb>;

// ~3 meses — mesma unidade usada no resto do app pra "período recente"
// (ex.: CACHE_TTL_MS em series.service.ts usa ms também).
const RECENT_ACTIVITY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

// Lista pronta pra Home ("Continuar assistindo") — lê direto de
// series_watch_progress, já calculado pelo cron (ver
// refresh-episodes.job.ts/watch-progress.service.ts); nenhuma chamada à
// TMDB acontece aqui. "assistiu nos últimos 3 meses" é calculado ao vivo
// (MAX(watchedAt), mesmo padrão de getRecentlyWatchedSeries em
// entries.service.ts) — não depende do cron, sempre atual.
export async function getContinueWatching(db: Db, userId: string): Promise<ContinueWatchingItem[]> {
  const rows = await db.query.seriesWatchProgress.findMany({
    where: eq(seriesWatchProgress.userId, userId),
    with: { series: true },
  });
  if (rows.length === 0) {
    return [];
  }

  const recentRows = await db
    .select({
      seriesId: seriesEpisodeWatch.seriesId,
      lastWatchedAt: sql<number>`max(${seriesEpisodeWatch.watchedAt})`,
    })
    .from(seriesEpisodeWatch)
    .where(
      and(
        eq(seriesEpisodeWatch.userId, userId),
        inArray(
          seriesEpisodeWatch.seriesId,
          rows.map((row) => row.seriesId),
        ),
      ),
    )
    .groupBy(seriesEpisodeWatch.seriesId);
  const lastWatchedBySeriesId = new Map(recentRows.map((row) => [row.seriesId, row.lastWatchedAt]));

  const now = Date.now();
  const items: ContinueWatchingItem[] = rows.map((row) => {
    const lastWatchedAt = lastWatchedBySeriesId.get(row.seriesId);
    const recentlyActive =
      lastWatchedAt !== undefined && now - lastWatchedAt <= RECENT_ACTIVITY_WINDOW_MS;

    return {
      series: mapCachedSeriesToSummary(row.series),
      nextEpisode: {
        seasonNumber: row.nextEpisodeSeasonNumber,
        episodeNumber: row.nextEpisodeNumber,
        name: row.nextEpisodeName,
        airDate: row.nextEpisodeAirDate.toISOString().slice(0, 10),
      },
      recentlyActive,
    };
  });

  // Ativa nos últimos 3 meses primeiro; dentro de cada grupo, episódio
  // liberado mais recentemente primeiro.
  items.sort((a, b) => {
    if (a.recentlyActive !== b.recentlyActive) {
      return a.recentlyActive ? -1 : 1;
    }
    return b.nextEpisode.airDate.localeCompare(a.nextEpisode.airDate);
  });

  return items;
}

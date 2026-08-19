import { and, eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { seriesEpisodeWatch, seriesWatchProgress } from "../db/schema";
import { type CachedSeries, getOrCacheSeries } from "./series.service";
import { computeNextUnwatchedEpisode, type SeasonCache } from "./watch-progress.service";

type Db = ReturnType<typeof createDb>;

// "Acompanhada" pro cron = tem pelo menos 1 episódio assistido por alguém
// — mais restrito que "tem series_entry" (favoritado/avaliado sem nunca
// ter assistido nada), evita gastar requests da TMDB à toa. A tela de
// detalhe já cobre a primeira visita de qualquer série.
async function getTrackedPairs(db: Db): Promise<{ userId: string; seriesId: number }[]> {
  return db
    .selectDistinct({
      userId: seriesEpisodeWatch.userId,
      seriesId: seriesEpisodeWatch.seriesId,
    })
    .from(seriesEpisodeWatch);
}

async function upsertWatchProgress(
  db: Db,
  userId: string,
  seriesId: number,
  nextEpisode: Awaited<ReturnType<typeof computeNextUnwatchedEpisode>>,
): Promise<void> {
  if (!nextEpisode) {
    // Sem episódio pendente — o usuário terminou de assistir tudo que já
    // foi ao ar (ou nunca teve lacuna). Remove a linha, se existir; é
    // assim que "Continuar assistindo" sabe que essa série não deve mais
    // aparecer (ver series/continue-watching, feita na próxima etapa).
    await db
      .delete(seriesWatchProgress)
      .where(
        and(eq(seriesWatchProgress.userId, userId), eq(seriesWatchProgress.seriesId, seriesId)),
      );
    return;
  }

  await db
    .insert(seriesWatchProgress)
    .values({
      userId,
      seriesId,
      nextEpisodeSeasonNumber: nextEpisode.seasonNumber,
      nextEpisodeNumber: nextEpisode.episodeNumber,
      nextEpisodeName: nextEpisode.name,
      nextEpisodeAirDate: new Date(nextEpisode.airDate),
    })
    .onConflictDoUpdate({
      target: [seriesWatchProgress.userId, seriesWatchProgress.seriesId],
      set: {
        nextEpisodeSeasonNumber: nextEpisode.seasonNumber,
        nextEpisodeNumber: nextEpisode.episodeNumber,
        nextEpisodeName: nextEpisode.name,
        nextEpisodeAirDate: new Date(nextEpisode.airDate),
      },
    });
}

// Disparado pelo Cron Trigger (ver scheduled() em index.ts, 1x/dia).
// Duas fases: (1) atualiza o cache global de cada série acompanhada, uma
// vez por série (não por usuário — reusa getOrCacheSeries tal como já
// existe); (2) pra cada par usuário×série, calcula o próximo episódio não
// assistido de verdade (ver watch-progress.service.ts) e grava em
// series_watch_progress. 1 série ou 1 par falhando não derruba os demais.
export async function refreshTrackedSeriesEpisodes(env: Env, db: Db): Promise<void> {
  const pairs = await getTrackedPairs(db);
  const seriesIds = [...new Set(pairs.map((pair) => pair.seriesId))];

  const cachedSeriesById = new Map<number, CachedSeries>();
  for (const seriesId of seriesIds) {
    try {
      cachedSeriesById.set(seriesId, await getOrCacheSeries(env, db, seriesId));
    } catch (error) {
      console.error(`[refresh-episodes] Falha ao atualizar a série ${seriesId}:`, error);
    }
  }

  const seasonCache: SeasonCache = new Map();
  for (const { userId, seriesId } of pairs) {
    const cachedSeries = cachedSeriesById.get(seriesId);
    if (!cachedSeries) {
      continue; // série falhou na fase 1 — sem dado confiável pra calcular progresso
    }
    try {
      const nextEpisode = await computeNextUnwatchedEpisode(
        env,
        db,
        seasonCache,
        userId,
        cachedSeries,
      );
      await upsertWatchProgress(db, userId, seriesId, nextEpisode);
    } catch (error) {
      console.error(
        `[refresh-episodes] Falha ao calcular progresso do usuário ${userId} na série ${seriesId}:`,
        error,
      );
    }
  }
}

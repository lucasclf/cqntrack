import type { createDb } from "../db/client";
import { seriesEpisodeWatch } from "../db/schema";
import { getOrCacheSeries } from "./series.service";

type Db = ReturnType<typeof createDb>;

// "Série acompanhada" pro cron = tem pelo menos 1 episódio assistido por
// alguém (qualquer usuário) — mais restrito que "tem series_entry" (que
// inclui favoritado/avaliado sem nunca ter assistido nada), evita gastar
// requests da TMDB com séries de baixo valor pra esse refresh específico.
// A tela de detalhe já cobre a primeira visita de qualquer série.
async function getTrackedSeriesIds(db: Db): Promise<number[]> {
  const rows = await db
    .selectDistinct({ seriesId: seriesEpisodeWatch.seriesId })
    .from(seriesEpisodeWatch);
  return rows.map((row) => row.seriesId);
}

// Disparado pelo Cron Trigger (ver scheduled() em index.ts, 1x/dia) — reusa
// getOrCacheSeries tal como já existe (mesma função que a tela de detalhe
// chama), só que pra toda série acompanhada, não só a que alguém abriu.
// 1 série falhando (TMDB fora do ar, id removido etc.) não derruba as
// demais — cada chamada é isolada.
export async function refreshTrackedSeriesEpisodes(env: Env, db: Db): Promise<void> {
  const seriesIds = await getTrackedSeriesIds(db);

  for (const seriesId of seriesIds) {
    try {
      await getOrCacheSeries(env, db, seriesId);
    } catch (error) {
      console.error(`[refresh-episodes] Falha ao atualizar a série ${seriesId}:`, error);
    }
  }
}

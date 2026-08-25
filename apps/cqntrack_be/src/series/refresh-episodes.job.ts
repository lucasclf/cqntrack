import { and, asc, lt, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { series, seriesEpisodeWatch } from "../db/schema";
import { refreshSeriesForCron } from "./series.service";

type Db = ReturnType<typeof createDb>;

// Mesmo TTL de series.service.ts (CACHE_TTL_MS) — só entra na leva quem já
// passou desse tempo sem revalidar; evita rebater na TMDB uma série que
// acabou de ser atualizada por outra execução do cron ou por alguém abrindo
// o detalhe.
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Quantas séries por execução — teto seguro dado o orçamento de 50
// subrequests/invocação do Free e o custo de 2 subrequests/série de
// refreshSeriesForCron (2 * 20 = 40, com folga pra eventuais retries).
const CRON_BATCH_SIZE = 20;

// "Série acompanhada" pro cron = tem pelo menos 1 episódio assistido por
// alguém (qualquer usuário) — mais restrito que "tem series_entry" (que
// inclui favoritado/avaliado sem nunca ter assistido nada), evita gastar
// requests da TMDB com séries de baixo valor pra esse refresh específico.
// A tela de detalhe já cobre a primeira visita de qualquer série.
//
// Filtra ended/canceled (nunca mais lançam episódio novo, não vale a pena
// reconsultar) e ordena pela mais desatualizada primeiro — como só ~50
// séries não-finalizadas existem na base hoje (bem menos que 20 * 24
// execuções/dia), cada rodada tende a esvaziar sozinha, sobrando fôlego
// pra manutenção incremental no resto do dia.
async function getStaleTrackedSeriesIds(db: Db): Promise<number[]> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
  const rows = await db
    .select({ seriesId: series.tmdbId })
    .from(series)
    .innerJoin(seriesEpisodeWatch, sql`${seriesEpisodeWatch.seriesId} = ${series.tmdbId}`)
    .where(
      and(
        sql`(lower(${series.status}) NOT IN ('ended', 'canceled') OR ${series.status} IS NULL)`,
        lt(series.updatedAt, staleThreshold),
      ),
    )
    .groupBy(series.tmdbId)
    .orderBy(asc(series.updatedAt))
    .limit(CRON_BATCH_SIZE);
  return rows.map((row) => row.seriesId);
}

// Disparado pelo Cron Trigger (ver scheduled() em index.ts, de hora em
// hora) — atualiza só o cache de próximo episódio/último lançado (sem
// elenco/direção, ver refreshSeriesForCron) das séries acompanhadas mais
// desatualizadas. 1 série falhando (TMDB fora do ar, id removido etc.) não
// derruba as demais — cada chamada é isolada.
export async function refreshTrackedSeriesEpisodes(env: Env, db: Db): Promise<void> {
  const seriesIds = await getStaleTrackedSeriesIds(db);

  for (const seriesId of seriesIds) {
    try {
      await refreshSeriesForCron(env, db, seriesId);
    } catch (error) {
      console.error(`[refresh-episodes] Falha ao atualizar a série ${seriesId}:`, error);
    }
  }
}

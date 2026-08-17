import type { ImportTvTimeEpisode, ImportTvTimeResponse } from "@cqntrack/shared";
import type { createDb } from "../db/client";
import { seriesEpisodeWatch } from "../db/schema";
import { findSeriesByTvdbId } from "../integrations/tmdb/series";
import { ensureSeriesEntry } from "./entries.service";

type Db = ReturnType<typeof createDb>;

// D1 tem um teto de ~100 parâmetros vinculados por statement (confirmado na
// prática: um insert de 150 linhas — 5-6 parâmetros cada, incluindo o `id`
// gerado no cliente — já estoura com "too many SQL variables"). Cada linha
// usa até 6 (id, userId, seriesId, seasonNumber, episodeNumber, watchedAt),
// então 15 por chunk fica com folga real do teto mesmo no pior caso. Barato
// de CPU quebrar em vários INSERTs (é tudo dentro do mesmo request), então
// não tem custo real em manter esse número conservador mesmo pra séries com
// centenas de episódios (ex.: novela, anime longo).
const INSERT_CHUNK_SIZE = 15;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Agrupado por série no front (ver ImportTvTimeCsv.tsx) — diferente do
// Filmow (1 filme = 1 busca por texto na TMDB), a série já vem identificada
// pelo tvdb_id do próprio tvtime, então é só resolver pro id da TMDB (1
// chamada) e gravar todos os episódios assistidos dela num INSERT em lote —
// sem validar season/episode contra a TMDB (confia na numeração do tvtime,
// mesmo espírito de setEpisodeWatched, que também não valida o toggle
// manual de 1 episódio).
export async function importTvTimeSeries(
  env: Env,
  db: Db,
  userId: string,
  seriesTvdbId: number,
  title: string,
  episodes: ImportTvTimeEpisode[],
): Promise<ImportTvTimeResponse> {
  try {
    const tmdbId = await findSeriesByTvdbId(env, seriesTvdbId);
    if (!tmdbId) {
      return { seriesTvdbId, title, status: "not_found", episodesImported: 0 };
    }

    // fetchCredits/fetchOverviewFallback: false — mesmo racional do import
    // de filmes (ver movies/import.service.ts): cada série nova já bate o
    // teto de CPU do plano Free de Workers processando o JSON de
    // aggregate_credits; elenco/sinopse en-US backfilam sozinhos na
    // próxima vez que a série for aberta de verdade (ver isStale em
    // series.service.ts).
    await ensureSeriesEntry(env, db, userId, tmdbId, {
      fetchCredits: false,
      fetchOverviewFallback: false,
    });

    const rows = episodes.map((episode) => ({
      userId,
      seriesId: tmdbId,
      seasonNumber: episode.season,
      episodeNumber: episode.episode,
      ...(episode.watchedAt ? { watchedAt: new Date(episode.watchedAt) } : {}),
    }));

    for (const batch of chunk(rows, INSERT_CHUNK_SIZE)) {
      await db.insert(seriesEpisodeWatch).values(batch).onConflictDoNothing();
    }

    return { seriesTvdbId, title, status: "imported", episodesImported: rows.length };
  } catch {
    return { seriesTvdbId, title, status: "error", episodesImported: 0 };
  }
}

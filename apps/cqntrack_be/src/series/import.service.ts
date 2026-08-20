import type {
  ImportCinopsysShow,
  ImportCinopsysShowResult,
  ImportTvTimeEpisode,
  ImportTvTimeResponse,
} from "@cqntrack/shared";
import type { createDb } from "../db/client";
import { activity, seriesEpisodeWatch } from "../db/schema";
import { findSeriesByTvdbId } from "../integrations/tmdb/series";
import { ensureSeriesEntry } from "./entries.service";

type Db = ReturnType<typeof createDb>;

// Só entra em jogo pro import do Cinopsys — Trakt/tvtime sempre
// processavam 1 série por request (não precisavam de paralelismo). Aqui um
// único request pode trazer várias séries (ver ImportCinopsysSeriesRequestSchema),
// então processar em paralelo com um teto baixo reduz a latência total sem
// aumentar o CPU gasto (o fetch de getOrCacheSeries é I/O, não conta pro
// budget de CPU do Free tier).
const CONCURRENCY = 3;

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

// Chamada 1x pelo front ao final do loop de import (ver
// ImportTvTimeCsv.tsx), não por série — nada no caminho acima loga
// activity (mesmo espírito de "marcar 1 episódio é ruído demais pro feed",
// ver setEpisodeWatched em episodes.service.ts), então essa é a única
// entrada de activity que o import gera: um resumo agregado.
export async function logTvTimeImportActivity(
  db: Db,
  userId: string,
  importedSeriesCount: number,
  importedEpisodeCount: number,
): Promise<void> {
  if (importedSeriesCount <= 0) {
    return;
  }

  await db.insert(activity).values({
    userId,
    mediaType: "series",
    itemId: crypto.randomUUID(),
    itemTitle: `${importedSeriesCount} ${importedSeriesCount === 1 ? "série" : "séries"}`,
    itemHref: "/series/marcacoes",
    itemCoverUrl: null,
    type: "imported",
    metadata: { source: "tvtime", count: importedSeriesCount, episodeCount: importedEpisodeCount },
  });
}

// Mesmo espírito de importTvTimeSeries, mas sem o passo findSeriesByTvdbId
// (o tmdbId já vem resolvido no backup do Cinopsys, processado no
// navegador — ver ImportCinopsysJson.tsx) e sem rating (o backup só tem a
// nota agregada da própria TMDB, não uma nota pessoal do usuário).
async function importCinopsysOne(
  env: Env,
  db: Db,
  userId: string,
  show: ImportCinopsysShow,
): Promise<ImportCinopsysShowResult> {
  try {
    await ensureSeriesEntry(env, db, userId, show.tmdbId, {
      fetchCredits: false,
      fetchOverviewFallback: false,
    });

    const rows = show.episodes.map((episode) => ({
      userId,
      seriesId: show.tmdbId,
      seasonNumber: episode.season,
      episodeNumber: episode.episode,
      ...(episode.watchedAt ? { watchedAt: new Date(episode.watchedAt) } : {}),
    }));

    for (const batch of chunk(rows, INSERT_CHUNK_SIZE)) {
      await db.insert(seriesEpisodeWatch).values(batch).onConflictDoNothing();
    }

    return {
      tmdbId: show.tmdbId,
      title: show.title,
      status: "imported",
      episodesImported: rows.length,
    };
  } catch {
    return { tmdbId: show.tmdbId, title: show.title, status: "error", episodesImported: 0 };
  }
}

// Um request pode trazer várias séries (ver ImportCinopsysSeriesRequestSchema
// em packages/shared) — processadas com CONCURRENCY baixo (ver constante no
// topo do arquivo), cada uma com seu próprio ensureSeriesEntry + inserts em
// lote, sem risco de corrida (tmdbId não se repete dentro do array).
export async function importCinopsysSeries(
  env: Env,
  db: Db,
  userId: string,
  shows: ImportCinopsysShow[],
): Promise<ImportCinopsysShowResult[]> {
  const results: ImportCinopsysShowResult[] = new Array<ImportCinopsysShowResult>(shows.length);

  let cursor = 0;
  async function worker() {
    while (cursor < shows.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await importCinopsysOne(env, db, userId, shows[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, shows.length) }, () => worker()));

  return results;
}

// Mesmo racional de logTvTimeImportActivity — resumo agregado, não 1 por
// série (import roda com logActivity: false, ver importCinopsysOne acima).
export async function logCinopsysSeriesImportActivity(
  db: Db,
  userId: string,
  importedSeriesCount: number,
  importedEpisodeCount: number,
): Promise<void> {
  if (importedSeriesCount <= 0) {
    return;
  }

  await db.insert(activity).values({
    userId,
    mediaType: "series",
    itemId: crypto.randomUUID(),
    itemTitle: `${importedSeriesCount} ${importedSeriesCount === 1 ? "série" : "séries"}`,
    itemHref: "/series/marcacoes",
    itemCoverUrl: null,
    type: "imported",
    metadata: {
      source: "cinopsys",
      count: importedSeriesCount,
      episodeCount: importedEpisodeCount,
    },
  });
}

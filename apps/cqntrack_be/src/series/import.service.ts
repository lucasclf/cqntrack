import type {
  ImportTvTimeEpisode,
  ImportTvTimeResponse,
  ImportTraktShowResponse,
  TraktImportableShow,
  TraktShowsPreviewResponse,
} from "@cqntrack/shared";
import type { createDb } from "../db/client";
import { activity, seriesEpisodeWatch } from "../db/schema";
import { findSeriesByTvdbId } from "../integrations/tmdb/series";
import { getShowRatings, getWatchedShows, toCqntrackRating } from "../integrations/trakt/client";
import { ensureSeriesEntry, upsertSeriesEntry } from "./entries.service";

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

// Busca as séries assistidas + notas do Trakt (só perfil público — ver
// integrations/trakt/client.ts) e junta os dois por tmdb_id — diferente do
// tvtime, nem precisa do passo findSeriesByTvdbId (o Trakt já entrega o
// tmdb_id, com o detalhamento de temporada/episódio na mesma resposta).
// null quando o perfil está privado ou não existe.
export async function getTraktShowsToImport(
  env: Env,
  username: string,
): Promise<TraktShowsPreviewResponse | null> {
  const [watched, ratings] = await Promise.all([
    getWatchedShows(env, username),
    getShowRatings(env, username),
  ]);
  if (!watched) {
    return null;
  }

  const ratingByTmdbId = new Map<number, number>();
  for (const entry of ratings ?? []) {
    const tmdbId = entry.show.ids.tmdb;
    if (tmdbId) {
      ratingByTmdbId.set(tmdbId, toCqntrackRating(entry.rating));
    }
  }

  const importable: TraktImportableShow[] = [];
  const notFound: { title: string }[] = [];
  for (const entry of watched) {
    const tmdbId = entry.show.ids.tmdb;
    if (!tmdbId) {
      notFound.push({ title: entry.show.title });
      continue;
    }

    const episodes: ImportTvTimeEpisode[] = entry.seasons.flatMap((season) =>
      season.episodes.map((episode) => ({
        season: season.number,
        episode: episode.number,
        watchedAt: episode.last_watched_at,
      })),
    );

    importable.push({
      tmdbId,
      title: entry.show.title,
      rating: ratingByTmdbId.get(tmdbId) ?? null,
      episodes,
    });
  }

  return { importable, notFound };
}

// Mesmo espírito de importTvTimeSeries, mas sem o passo findSeriesByTvdbId
// (o tmdb_id já vem resolvido pelo Trakt, ver getTraktShowsToImport) e com
// nota opcional. Só 1 chamada de getOrCacheSeries (via upsertSeriesEntry,
// não ensureSeriesEntry + upsertSeriesEntry separados) — cast fica null com
// fetchCredits: false (ver getOrCacheSeries em series.service.ts), o que
// isStale() sempre considera "desatualizado"; uma 2ª chamada pra mesma
// série no mesmo import refaria o fetch de detalhe à toa. `rating: null`
// vira `undefined` no patch de propósito (mesmo racional de importTraktOne
// em movies/import.service.ts) — não apaga uma nota que o usuário já
// tivesse posto manualmente antes.
export async function importTraktShow(
  env: Env,
  db: Db,
  userId: string,
  tmdbId: number,
  title: string,
  rating: number | null,
  episodes: ImportTvTimeEpisode[],
): Promise<ImportTraktShowResponse> {
  try {
    await upsertSeriesEntry(
      env,
      db,
      userId,
      tmdbId,
      { rating: rating ?? undefined },
      { logActivity: false, fetchCredits: false, fetchOverviewFallback: false },
    );

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

    return { tmdbId, title, status: "imported", episodesImported: rows.length };
  } catch {
    return { tmdbId, title, status: "error", episodesImported: 0 };
  }
}

// Mesmo racional de logTvTimeImportActivity — resumo agregado, não 1 por
// série (import roda com logActivity: false, ver importTraktShow acima).
export async function logTraktSeriesImportActivity(
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
    metadata: { source: "trakt", count: importedSeriesCount, episodeCount: importedEpisodeCount },
  });
}

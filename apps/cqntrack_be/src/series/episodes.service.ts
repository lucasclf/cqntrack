import type { SeriesSeasonEpisodesResponse } from "@cqntrack/shared";
import { and, eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, seriesEpisodeWatch } from "../db/schema";
import { getSeriesSeason } from "../integrations/tmdb/series";
import { buildPosterUrl } from "../integrations/tmdb/types";
import { ensureSeriesEntry } from "./entries.service";
import { toActivitySnapshot } from "./series.service";

type Db = ReturnType<typeof createDb>;

// Busca a temporada ao vivo na TMDB (sem cache local, ver
// db/schema/series.schema.ts) e marca `watched` a partir de
// series_episode_watch. null quando a temporada não existe na TMDB.
export async function getSeasonEpisodes(
  env: Env,
  db: Db,
  userId: string,
  tmdbId: number,
  seasonNumber: number,
): Promise<SeriesSeasonEpisodesResponse | null> {
  const season = await getSeriesSeason(env, tmdbId, seasonNumber);
  if (!season) {
    return null;
  }

  const watchedRows = await db
    .select({ episodeNumber: seriesEpisodeWatch.episodeNumber })
    .from(seriesEpisodeWatch)
    .where(
      and(
        eq(seriesEpisodeWatch.userId, userId),
        eq(seriesEpisodeWatch.seriesId, tmdbId),
        eq(seriesEpisodeWatch.seasonNumber, seasonNumber),
      ),
    );
  const watchedEpisodeNumbers = new Set(watchedRows.map((row) => row.episodeNumber));

  return {
    seasonNumber: season.season_number,
    episodes: season.episodes.map((episode) => ({
      episodeNumber: episode.episode_number,
      name: episode.name,
      airDate: episode.air_date && episode.air_date.length > 0 ? episode.air_date : null,
      stillUrl: episode.still_path ? buildPosterUrl(episode.still_path, "w185") : null,
      watched: watchedEpisodeNumbers.has(episode.episode_number),
    })),
  };
}

// Marcar 1 episódio é ruído demais pro feed de atividade — sem log aqui
// (diferente de setSeasonWatched). Confia que a UI só deixa marcar depois
// que a temporada já carregou da TMDB (sem validação extra de que o
// episódio existe de fato).
export async function setEpisodeWatched(
  env: Env,
  db: Db,
  userId: string,
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
  watched: boolean,
): Promise<void> {
  await ensureSeriesEntry(env, db, userId, tmdbId);

  if (watched) {
    await db
      .insert(seriesEpisodeWatch)
      .values({ userId, seriesId: tmdbId, seasonNumber, episodeNumber })
      .onConflictDoNothing();
  } else {
    await db
      .delete(seriesEpisodeWatch)
      .where(
        and(
          eq(seriesEpisodeWatch.userId, userId),
          eq(seriesEpisodeWatch.seriesId, tmdbId),
          eq(seriesEpisodeWatch.seasonNumber, seasonNumber),
          eq(seriesEpisodeWatch.episodeNumber, episodeNumber),
        ),
      );
  }
}

// Temporada inteira é um evento grosso o bastante pra valer aparecer no
// feed — só ao marcar (desmarcar não gera atividade, mesmo espírito de
// "desfavoritar não gera atividade").
export async function setSeasonWatched(
  env: Env,
  db: Db,
  userId: string,
  tmdbId: number,
  seasonNumber: number,
  watched: boolean,
): Promise<boolean> {
  const { cachedSeries } = await ensureSeriesEntry(env, db, userId, tmdbId);

  if (!watched) {
    await db
      .delete(seriesEpisodeWatch)
      .where(
        and(
          eq(seriesEpisodeWatch.userId, userId),
          eq(seriesEpisodeWatch.seriesId, tmdbId),
          eq(seriesEpisodeWatch.seasonNumber, seasonNumber),
        ),
      );
    return true;
  }

  const season = await getSeriesSeason(env, tmdbId, seasonNumber);
  if (!season) {
    return false;
  }

  if (season.episodes.length > 0) {
    await db
      .insert(seriesEpisodeWatch)
      .values(
        season.episodes.map((episode) => ({
          userId,
          seriesId: tmdbId,
          seasonNumber,
          episodeNumber: episode.episode_number,
        })),
      )
      .onConflictDoNothing();
  }

  await db.insert(activity).values({
    userId,
    ...toActivitySnapshot(cachedSeries),
    type: "season_watched",
    metadata: { season: seasonNumber, episodeCount: season.episodes.length },
  });

  return true;
}

import type {
  CrewMember,
  SeriesEpisodeDetail,
  SeriesSeasonEpisodesResponse,
} from "@cqntrack/shared";
import { and, eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, seriesEpisodeWatch } from "../db/schema";
import { getSeriesEpisode, getSeriesSeason } from "../integrations/tmdb/series";
import { buildPosterUrl, type TmdbCrewMember } from "../integrations/tmdb/types";
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

// A TMDB às vezes credita a mesma pessoa duas vezes como diretora do mesmo
// episódio (créditos duplicados) — dedupe por id, mesmo padrão já usado em
// movies.service.ts.
function mapCrewToDirectors(crew: TmdbCrewMember[]): CrewMember[] {
  const seen = new Set<number>();
  const directors: CrewMember[] = [];
  for (const member of crew) {
    if (member.job !== "Director" || seen.has(member.id)) continue;
    seen.add(member.id);
    directors.push({
      personId: member.id,
      name: member.name,
      profileUrl: member.profile_path ? buildPosterUrl(member.profile_path, "w185") : null,
    });
  }
  return directors;
}

// Detalhe completo de UM episódio (página própria) — buscado ao vivo, sem
// cache local, mesmo espírito de getSeasonEpisodes. `watched` vem de
// series_episode_watch, a mesma tabela já usada pra lista da temporada.
export async function getEpisodeDetail(
  env: Env,
  db: Db,
  userId: string,
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<SeriesEpisodeDetail | null> {
  const episode = await getSeriesEpisode(env, tmdbId, seasonNumber, episodeNumber);
  if (!episode) {
    return null;
  }

  const [watchedRow] = await db
    .select()
    .from(seriesEpisodeWatch)
    .where(
      and(
        eq(seriesEpisodeWatch.userId, userId),
        eq(seriesEpisodeWatch.seriesId, tmdbId),
        eq(seriesEpisodeWatch.seasonNumber, seasonNumber),
        eq(seriesEpisodeWatch.episodeNumber, episodeNumber),
      ),
    );

  return {
    seasonNumber,
    episodeNumber,
    name: episode.name,
    overview: episode.overview && episode.overview.length > 0 ? episode.overview : null,
    airDate: episode.air_date && episode.air_date.length > 0 ? episode.air_date : null,
    stillUrl: episode.still_path ? buildPosterUrl(episode.still_path, "w342") : null,
    runtime: episode.runtime ?? null,
    rating: episode.vote_average ?? null,
    watched: watchedRow !== undefined,
    directors: mapCrewToDirectors(episode.crew),
  };
}

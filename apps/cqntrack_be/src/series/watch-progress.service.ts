import { and, eq, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import type { CachedSeriesUpcomingEpisode } from "../db/schema/series.schema";
import { seriesEpisodeWatch } from "../db/schema";
import { getSeriesSeason } from "../integrations/tmdb/series";
import type { TmdbSeasonDetail } from "../integrations/tmdb/types";
import type { CachedSeries } from "./series.service";

type Db = ReturnType<typeof createDb>;

// Cache de temporada por rodada de cron, injetado de fora — várias pessoas
// podem acompanhar a mesma série, sem sentido rebuscar a mesma temporada
// na TMDB pra cada uma dentro da mesma execução (ver refresh-episodes.job.ts).
export type SeasonCache = Map<string, TmdbSeasonDetail | null>;

function seasonCacheKey(tmdbId: number, seasonNumber: number): string {
  return `${tmdbId}-${seasonNumber}`;
}

async function fetchSeasonCached(
  env: Env,
  cache: SeasonCache,
  tmdbId: number,
  seasonNumber: number,
): Promise<TmdbSeasonDetail | null> {
  const key = seasonCacheKey(tmdbId, seasonNumber);
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const season = await getSeriesSeason(env, tmdbId, seasonNumber);
  cache.set(key, season);
  return season;
}

// Acha o primeiro episódio, na ordem de exibição, que já foi ao ar e ainda
// não foi assistido por esse usuário — não é "o mais recente lançado" (ver
// series.lastEpisodeToAir, usado pro aviso na tela da série): aqui
// respeita a ordem de verdade, então funciona certo mesmo se o usuário
// pulou episódios ou está várias temporadas atrasado.
//
// Temporada 0 (especiais) fica de fora de propósito — não faz parte da
// progressão principal da história, então não faz sentido travar "o que
// assistir a seguir" numa especial que ninguém assistiu.
//
// Custo: no caso comum (usuário em dia até a temporada atual), 1 request à
// TMDB — só busca a temporada onde `assistidos < total` (comparação feita
// com dados já cacheados, sem custo de TMDB); segue pra próxima só se essa
// temporada, na prática, não tiver lacuna real (a diferença era só
// episódio-ainda-não-lançado).
export async function computeNextUnwatchedEpisode(
  env: Env,
  db: Db,
  seasonCache: SeasonCache,
  userId: string,
  cachedSeries: CachedSeries,
): Promise<CachedSeriesUpcomingEpisode | null> {
  const seasons = (cachedSeries.seasons ?? [])
    .filter((season) => season.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  if (seasons.length === 0) {
    return null;
  }

  const [watchedCountRows, watchedEpisodeRows] = await Promise.all([
    db
      .select({ seasonNumber: seriesEpisodeWatch.seasonNumber, count: sql<number>`count(*)` })
      .from(seriesEpisodeWatch)
      .where(
        and(
          eq(seriesEpisodeWatch.userId, userId),
          eq(seriesEpisodeWatch.seriesId, cachedSeries.tmdbId),
        ),
      )
      .groupBy(seriesEpisodeWatch.seasonNumber),
    db
      .select({
        seasonNumber: seriesEpisodeWatch.seasonNumber,
        episodeNumber: seriesEpisodeWatch.episodeNumber,
      })
      .from(seriesEpisodeWatch)
      .where(
        and(
          eq(seriesEpisodeWatch.userId, userId),
          eq(seriesEpisodeWatch.seriesId, cachedSeries.tmdbId),
        ),
      ),
  ]);

  const watchedCountBySeason = new Map(
    watchedCountRows.map((row) => [row.seasonNumber, row.count]),
  );
  const watchedKeys = new Set(
    watchedEpisodeRows.map((row) => `${row.seasonNumber}-${row.episodeNumber}`),
  );

  const now = Date.now();

  for (const season of seasons) {
    const watchedCount = watchedCountBySeason.get(season.seasonNumber) ?? 0;
    if (watchedCount >= season.episodeCount) {
      continue; // temporada inteira já assistida, sem lacuna possível
    }

    const seasonDetail = await fetchSeasonCached(
      env,
      seasonCache,
      cachedSeries.tmdbId,
      season.seasonNumber,
    );
    if (!seasonDetail) {
      continue; // temporada não encontrada na TMDB (raro) — tenta a próxima
    }

    const episodesInOrder = [...seasonDetail.episodes].sort(
      (a, b) => a.episode_number - b.episode_number,
    );
    for (const episode of episodesInOrder) {
      if (!episode.air_date) {
        continue; // sem data ainda (ex.: "TBA") — não dá pra dizer se já foi ao ar
      }
      if (new Date(episode.air_date).getTime() > now) {
        break; // episódios seguintes na mesma temporada também são futuros
      }
      const key = `${season.seasonNumber}-${episode.episode_number}`;
      if (!watchedKeys.has(key)) {
        return {
          seasonNumber: season.seasonNumber,
          episodeNumber: episode.episode_number,
          name: episode.name,
          airDate: episode.air_date,
        };
      }
    }
  }

  return null;
}

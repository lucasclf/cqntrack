import type { ContinueWatchingItem } from "@cqntrack/shared";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { series, seriesEntry, seriesEpisodeWatch } from "../db/schema";
import { getSeriesSeason } from "../integrations/tmdb/series";
import { type CachedSeries, getOrCacheSeries, mapCachedSeriesToSummary } from "./series.service";

type Db = ReturnType<typeof createDb>;
type NextEpisode = ContinueWatchingItem["nextEpisode"];
type SeasonSummary = NonNullable<CachedSeries["seasons"]>[number];

// ~3 meses — mesma unidade usada no resto do app pra "período recente".
const RECENT_ACTIVITY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
// Mesma janela de 24h de isStale em series.service.ts — não reaproveitamos
// aquela função porque ela também considera cast===null como "sempre
// stale" (regra pensada pro import em massa do tvtime), o que faria uma
// série nunca aberta na tela de detalhe ser rechecada em toda carga da
// Home, todo dia. Aqui só interessa a idade do cache.
const SERIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ENDED_STATUSES = new Set(["ended", "canceled"]);

// Teto de chamadas à TMDB (contando o par detalhe+créditos de
// getOrCacheSeries como 2) numa única carga da Home — protege contra o
// limite de subrequests por invocação do Worker. O cron antigo processava
// todas as séries acompanhadas numa invocação só e estourava esse limite
// (ver commit que introduziu esse comentário); aqui o trabalho é
// delimitado por relevância (só quem tem lacuna conhecida ou está
// desatualizado há +24h gasta orçamento), mas ainda assim precisa de um
// teto — série que não coube nesta carga simplesmente não aparece agora, a
// próxima visita à Home tenta de novo. Deixado conservador (bem abaixo do
// teto de subrequests por invocação) porque as queries em lote abaixo já
// consomem uma parte desse mesmo orçamento.
const LIVE_TMDB_BUDGET = 12;

// Cache curto (minutos, não 24h) só pra esta tela — getSeriesSeason em si
// continua 100% sem cache (integrations/tmdb/series.ts), decisão correta
// pra tela de episódio, onde o dado precisa estar sempre fresco. Aqui o
// "próximo episódio pendente" é recalculado do zero toda vez que a Home
// carrega; sem esse cache próprio, cada visita repetida paga de novo o
// custo sequencial de N chamadas à TMDB (uma por série com lacuna) —
// medido ao vivo: ~1,2-1,9s consistentes pra só 6 séries com lacuna, único
// gargalo real (as queries D1 em lote já são baratas). 5min é curto o
// bastante pra nunca mostrar um episódio errado por muito tempo, longo o
// bastante pra cobrir o padrão comum de "usuário volta pra Home várias
// vezes na mesma sessão". Só dura o isolate do Worker — reinicia sozinho a
// cada cold start, sem staleness real acumulada.
const SEASON_CACHE_TTL_MS = 5 * 60 * 1000;
const seasonCache = new Map<
  string,
  { value: Awaited<ReturnType<typeof getSeriesSeason>>; expiresAt: number }
>();

// Exportado só pra teste — mesmo padrão de resetIgdbTokenMemoryCache/
// resetRateLimiter (games): sem isso, o cache em memória (nível de módulo)
// atravessaria casos de teste diferentes dentro do mesmo arquivo.
export function resetSeasonCache(): void {
  seasonCache.clear();
}

async function getCachedSeriesSeason(
  env: Env,
  tmdbId: number,
  seasonNumber: number,
): ReturnType<typeof getSeriesSeason> {
  const key = `${tmdbId}-${seasonNumber}`;
  const cached = seasonCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const value = await getSeriesSeason(env, tmdbId, seasonNumber);
  seasonCache.set(key, { value, expiresAt: Date.now() + SEASON_CACHE_TTL_MS });
  return value;
}

// D1 limita 100 parâmetros bindados por query (ver
// developers.cloudflare.com/d1/platform/limits) — bem menos do que uma
// conta com muitas séries acompanhadas precisa num "IN (...)" só (chegou a
// estourar com 284 ids reais em produção, ver histórico). Divide em fatias
// seguras e dispara em paralelo, em vez de voltar pro padrão de 1 query por
// série que os lotes abaixo existem justamente pra evitar.
const D1_PARAM_CHUNK_SIZE = 95;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function queryInChunks<T>(
  ids: number[],
  run: (idsChunk: number[]) => Promise<T[]>,
): Promise<T[]> {
  const results = await Promise.all(chunk(ids, D1_PARAM_CHUNK_SIZE).map(run));
  return results.flat();
}

function isSeriesCacheStale(row: CachedSeries): boolean {
  return Date.now() - row.updatedAt.getTime() > SERIES_CACHE_TTL_MS;
}

function sortedSeasons(cachedSeries: CachedSeries): SeasonSummary[] {
  // Temporada 0 (especiais) fica de fora de propósito — não faz parte da
  // progressão principal da história.
  return (cachedSeries.seasons ?? [])
    .filter((season) => season.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

function hasKnownGap(seasons: SeasonSummary[], watchedCountBySeason: Map<number, number>): boolean {
  return seasons.some(
    (season) => (watchedCountBySeason.get(season.seasonNumber) ?? 0) < season.episodeCount,
  );
}

// Busca temporada por temporada (a partir da primeira com lacuna, por
// contagem já cacheada) até achar o primeiro episódio já lançado e não
// assistido — não é "o mais recente lançado" (ver CachedSeries.
// lastEpisodeToAir): respeita a ordem de verdade, funciona mesmo se o
// usuário pulou episódios. `budget` é decrementado por temporada
// consultada; se estourar, devolve null (série some desta carga, tenta de
// novo na próxima).
async function findNextUnwatchedEpisode(
  env: Env,
  tmdbId: number,
  seasons: SeasonSummary[],
  watchedCountBySeason: Map<number, number>,
  watchedKeys: Set<string>,
  budget: { remaining: number },
): Promise<NextEpisode | null> {
  const now = Date.now();

  for (const season of seasons) {
    const watchedCount = watchedCountBySeason.get(season.seasonNumber) ?? 0;
    if (watchedCount >= season.episodeCount) {
      continue; // temporada inteira já assistida, sem lacuna possível
    }
    if (budget.remaining <= 0) {
      return null;
    }
    budget.remaining -= 1;

    const seasonDetail = await getCachedSeriesSeason(env, tmdbId, season.seasonNumber);
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

export interface ContinueWatchingPage {
  items: ContinueWatchingItem[];
  nextCursor: number | null;
}

// Casos A/B/C do comentário de getContinueWatching, isolados pra reuso: tanto o
// carregamento em lote (Home) quanto getContinueWatchingItemForSeries (recalcular 1
// série só depois de marcar um episódio, ver series.routes.ts) resolvem exatamente a
// mesma coisa — só muda quantas séries são processadas de uma vez. `cachedSeries` pode
// voltar diferente do que entrou (getOrCacheSeries revalida o cache quando stale).
async function resolveNextEpisodeForSeries(
  env: Env,
  db: Db,
  seriesId: number,
  cachedSeries: CachedSeries,
  watchedCountBySeason: Map<number, number>,
  watchedKeys: Set<string>,
  budget: { remaining: number },
): Promise<{ cachedSeries: CachedSeries; nextEpisode: NextEpisode | null }> {
  let seasons = sortedSeasons(cachedSeries);

  if (hasKnownGap(seasons, watchedCountBySeason)) {
    // Caso A.
    const nextEpisode = await findNextUnwatchedEpisode(
      env,
      seriesId,
      seasons,
      watchedCountBySeason,
      watchedKeys,
      budget,
    );
    return { cachedSeries, nextEpisode };
  }

  const status = cachedSeries.status?.toLowerCase() ?? null;
  const isEndedOrCanceled = status !== null && ENDED_STATUSES.has(status);

  // Caso B: ended/canceled e em dia — nunca mais reconsulta.
  // Caso C: ainda ativa e em dia — só reconsulta se estiver stale.
  if (!isEndedOrCanceled && isSeriesCacheStale(cachedSeries) && budget.remaining > 0) {
    budget.remaining -= 2; // getOrCacheSeries faz até 2 requests (detalhe + créditos)
    cachedSeries = await getOrCacheSeries(env, db, seriesId);
    seasons = sortedSeasons(cachedSeries);

    if (hasKnownGap(seasons, watchedCountBySeason)) {
      const nextEpisode = await findNextUnwatchedEpisode(
        env,
        seriesId,
        seasons,
        watchedCountBySeason,
        watchedKeys,
        budget,
      );
      return { cachedSeries, nextEpisode };
    }
  }

  return { cachedSeries, nextEpisode: null };
}

// Lista pronta pra Home ("Continuar assistindo"), calculada ao vivo a cada
// carregamento — sem tabela de progresso pré-computada por cron (ver
// histórico: processar todas as séries acompanhadas numa invocação só
// estourava o limite de subrequests do Worker). Em vez disso, o trabalho é
// delimitado por 3 situações:
//
// A) Série com lacuna já visível pelos dados cacheados (assistidos <
//    episódios da temporada) — sempre busca o episódio exato, não importa
//    o status.
// B) Série ended/canceled e o usuário já assistiu tudo que temos cacheado
//    — nunca mais precisa reconsultar a TMDB, não aparece.
// C) Série ainda ativa (status diferente de ended/canceled) e o usuário já
//    assistiu tudo que temos cacheado — só reconsulta a TMDB se o cache
//    dessa série estiver desatualizado há mais de 24h; caso contrário,
//    confia no que já sabemos (nada pendente).
//
// Série marcada como abandonada (seriesEntry.abandonedAt, ver
// SeriesDetail) nunca entra nessas contas — filtrada antes de tudo,
// independente de ter lacuna real ou não.
//
// Paginação: as séries candidatas são ordenadas uma vez, ANTES de resolver
// qualquer episódio, usando só dado já em cache local (recentlyActive +
// lastEpisodeToAir, sem TMDB) — critério aproximado (não é sempre
// idêntico ao episódio pendente exato), mas estável entre páginas, o que
// dá pra paginar de verdade sem pular/duplicar item na rolagem infinita.
// `cursor` é o índice nessa lista ordenada; cada página resolve candidatas
// a partir dele até juntar `pageSize` itens, estourar o orçamento de TMDB
// (para a página no meio, sem consumir a candidata seguinte — ela vira o
// `nextCursor`, tentada de novo na próxima página) ou acabar a lista.
export async function getContinueWatching(
  env: Env,
  db: Db,
  userId: string,
  cursor = 0,
  pageSize = 12,
): Promise<ContinueWatchingPage> {
  const [trackedRows, abandonedRows] = await Promise.all([
    db
      .selectDistinct({ seriesId: seriesEpisodeWatch.seriesId })
      .from(seriesEpisodeWatch)
      .where(eq(seriesEpisodeWatch.userId, userId)),
    // Filtra por userId só (sem IN de seriesIds) — não precisa de chunk.
    db
      .select({ seriesId: seriesEntry.seriesId })
      .from(seriesEntry)
      .where(and(eq(seriesEntry.userId, userId), isNotNull(seriesEntry.abandonedAt))),
  ]);
  const abandonedSeriesIds = new Set(abandonedRows.map((row) => row.seriesId));
  const seriesIds = trackedRows
    .map((row) => row.seriesId)
    .filter((seriesId) => !abandonedSeriesIds.has(seriesId));
  if (seriesIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  // watchedCountBySeries é derivado de watchedEpisodeRows em memória — uma
  // query agrupada (count por seriesId+seasonNumber) a menos pra rodar em
  // fatias, sem custo real (o dado já vem todo de watchedEpisodeRows).
  const [seriesRows, watchedEpisodeRows, recentRows] = await Promise.all([
    queryInChunks(seriesIds, (ids) => db.select().from(series).where(inArray(series.tmdbId, ids))),
    queryInChunks(seriesIds, (ids) =>
      db
        .select({
          seriesId: seriesEpisodeWatch.seriesId,
          seasonNumber: seriesEpisodeWatch.seasonNumber,
          episodeNumber: seriesEpisodeWatch.episodeNumber,
        })
        .from(seriesEpisodeWatch)
        .where(
          and(eq(seriesEpisodeWatch.userId, userId), inArray(seriesEpisodeWatch.seriesId, ids)),
        ),
    ),
    queryInChunks(seriesIds, (ids) =>
      db
        .select({
          seriesId: seriesEpisodeWatch.seriesId,
          lastWatchedAt: sql<number>`max(${seriesEpisodeWatch.watchedAt})`,
        })
        .from(seriesEpisodeWatch)
        .where(
          and(eq(seriesEpisodeWatch.userId, userId), inArray(seriesEpisodeWatch.seriesId, ids)),
        )
        .groupBy(seriesEpisodeWatch.seriesId),
    ),
  ]);

  const seriesById = new Map(seriesRows.map((row) => [row.tmdbId, row]));

  const watchedCountBySeries = new Map<number, Map<number, number>>();
  const watchedKeysBySeries = new Map<number, Set<string>>();
  for (const row of watchedEpisodeRows) {
    const bySeason = watchedCountBySeries.get(row.seriesId) ?? new Map<number, number>();
    bySeason.set(row.seasonNumber, (bySeason.get(row.seasonNumber) ?? 0) + 1);
    watchedCountBySeries.set(row.seriesId, bySeason);

    const keys = watchedKeysBySeries.get(row.seriesId) ?? new Set<string>();
    keys.add(`${row.seasonNumber}-${row.episodeNumber}`);
    watchedKeysBySeries.set(row.seriesId, keys);
  }

  const lastWatchedBySeries = new Map(recentRows.map((row) => [row.seriesId, row.lastWatchedAt]));
  const now = Date.now();
  const recentlyActiveBySeries = new Map(
    seriesIds.map((seriesId) => {
      const lastWatchedAt = lastWatchedBySeries.get(seriesId);
      return [
        seriesId,
        lastWatchedAt !== undefined && now - lastWatchedAt <= RECENT_ACTIVITY_WINDOW_MS,
      ] as const;
    }),
  );

  // Ordena as candidatas 1x, antes de resolver qualquer episódio — só com
  // dado já em cache local (sem TMDB), pra ficar estável entre páginas:
  // ativa nos últimos 3 meses primeiro; dentro de cada grupo, último
  // episódio já lançado (segundo o cache da série) mais recente primeiro.
  // Aproxima o critério de ordenação antigo (episódio pendente exato) sem
  // depender da TMDB pra ordenar — só pra resolver o episódio de cada item
  // da página atual.
  const sortedCandidates = [...seriesIds].sort((a, b) => {
    const aRecent = recentlyActiveBySeries.get(a) ?? false;
    const bRecent = recentlyActiveBySeries.get(b) ?? false;
    if (aRecent !== bRecent) {
      return aRecent ? -1 : 1;
    }
    const aDate = seriesById.get(a)?.lastEpisodeToAir?.airDate ?? "";
    const bDate = seriesById.get(b)?.lastEpisodeToAir?.airDate ?? "";
    if (aDate !== bDate) {
      return bDate.localeCompare(aDate);
    }
    return a - b; // tiebreaker estável (mesmo par nunca inverte entre páginas)
  });

  const budget = { remaining: LIVE_TMDB_BUDGET };
  const items: ContinueWatchingItem[] = [];
  const startIndex = Math.min(cursor, sortedCandidates.length);
  let index = startIndex;

  for (; index < sortedCandidates.length; index++) {
    if (items.length >= pageSize || budget.remaining <= 0) {
      // Página cheia, ou orçamento de TMDB estourou nesta requisição — para
      // sem consumir a candidata atual, ela vira o cursor da próxima
      // página (não foi avaliada ainda, nem parcialmente).
      break;
    }

    const seriesId = sortedCandidates[index]!;
    let cachedSeries = seriesById.get(seriesId);
    if (!cachedSeries) {
      continue; // referência órfã (não deveria acontecer, FK garante) — pula em vez de quebrar a Home inteira
    }

    const watchedCountBySeason = watchedCountBySeries.get(seriesId) ?? new Map<number, number>();
    const watchedKeys = watchedKeysBySeries.get(seriesId) ?? new Set<string>();

    const resolved = await resolveNextEpisodeForSeries(
      env,
      db,
      seriesId,
      cachedSeries,
      watchedCountBySeason,
      watchedKeys,
      budget,
    );
    cachedSeries = resolved.cachedSeries;
    const nextEpisode = resolved.nextEpisode;

    if (!nextEpisode) {
      continue;
    }

    items.push({
      series: mapCachedSeriesToSummary(cachedSeries),
      nextEpisode,
      recentlyActive: recentlyActiveBySeries.get(seriesId) ?? false,
    });
  }

  // Itens já saem na ordem certa (mesma ordem de sortedCandidates, que já
  // é a ordem final de exibição) — sem reordenar de novo aqui, isso
  // quebraria a estabilidade entre páginas que o pré-sort existe pra
  // garantir.
  return {
    items,
    nextCursor: index < sortedCandidates.length ? index : null,
  };
}

// Orçamento bem menor que LIVE_TMDB_BUDGET (12) porque aqui só há 1 série pra resolver,
// não um lote inteiro — cobre getOrCacheSeries (2) + algumas temporadas de
// findNextUnwatchedEpisode sem se aproximar do teto de subrequests por invocação.
const SINGLE_SERIES_TMDB_BUDGET = 6;

// Recalcula o item de "Continuar assistindo" de UMA série específica — usado depois de
// marcar um episódio como assistido (ver series.routes.ts), pra atualizar só aquela
// linha na lista sem recarregar a Home inteira. Mesma resolução de casos A/B/C de
// getContinueWatching, só que sem paginação/cursor (não faz sentido pra 1 item só).
// `null` = a série não tem mais episódio pendente (some da lista no cliente) ou não é
// mais candidata (abandonada, ou nunca foi assistida por este usuário).
export async function getContinueWatchingItemForSeries(
  env: Env,
  db: Db,
  userId: string,
  tmdbId: number,
): Promise<ContinueWatchingItem | null> {
  const [cachedSeries, entryRow, watchedRows] = await Promise.all([
    db.query.series.findFirst({ where: eq(series.tmdbId, tmdbId) }),
    db.query.seriesEntry.findFirst({
      where: and(eq(seriesEntry.userId, userId), eq(seriesEntry.seriesId, tmdbId)),
    }),
    db
      .select({
        seasonNumber: seriesEpisodeWatch.seasonNumber,
        episodeNumber: seriesEpisodeWatch.episodeNumber,
        watchedAt: seriesEpisodeWatch.watchedAt,
      })
      .from(seriesEpisodeWatch)
      .where(and(eq(seriesEpisodeWatch.userId, userId), eq(seriesEpisodeWatch.seriesId, tmdbId))),
  ]);

  if (!cachedSeries || entryRow?.abandonedAt || watchedRows.length === 0) {
    return null;
  }

  const watchedCountBySeason = new Map<number, number>();
  const watchedKeys = new Set<string>();
  let lastWatchedAt = 0;
  for (const row of watchedRows) {
    watchedCountBySeason.set(
      row.seasonNumber,
      (watchedCountBySeason.get(row.seasonNumber) ?? 0) + 1,
    );
    watchedKeys.add(`${row.seasonNumber}-${row.episodeNumber}`);
    lastWatchedAt = Math.max(lastWatchedAt, row.watchedAt.getTime());
  }

  const budget = { remaining: SINGLE_SERIES_TMDB_BUDGET };
  const { cachedSeries: resolvedSeries, nextEpisode } = await resolveNextEpisodeForSeries(
    env,
    db,
    tmdbId,
    cachedSeries,
    watchedCountBySeason,
    watchedKeys,
    budget,
  );

  if (!nextEpisode) {
    return null;
  }

  return {
    series: mapCachedSeriesToSummary(resolvedSeries),
    nextEpisode,
    recentlyActive: Date.now() - lastWatchedAt <= RECENT_ACTIVITY_WINDOW_MS,
  };
}

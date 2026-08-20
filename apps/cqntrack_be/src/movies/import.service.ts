import type {
  ImportFilmowResult,
  ImportTraktMovieResult,
  TraktImportableMovie,
  TraktMoviesPreviewResponse,
} from "@cqntrack/shared";
import type { createDb } from "../db/client";
import { activity } from "../db/schema";
import { getMovieRatings, getWatchedMovies, toCqntrackRating } from "../integrations/trakt/client";
import { searchMovies as tmdbSearchMovies } from "../integrations/tmdb/movies";
import { upsertMovieEntry } from "./entries.service";
import { mapTmdbSearchResultToSummary } from "./movies.service";

type Db = ReturnType<typeof createDb>;

// Concorrência baixa — o front manda 1 título por request (ver BATCH_SIZE
// em ImportFilmowCsv.tsx: o plano Free de Workers só dá 10ms de CPU por
// invocação, e cada request a mais custa CPU de parse de JSON, não só rede
// — créditos e o fallback de sinopse em inglês são pulados de propósito,
// ver fetchCredits/fetchOverviewFallback abaixo). CONCURRENCY > 1 só entra
// em jogo se alguém chamar o endpoint direto com mais de 1 título no
// mesmo request (o schema permite até um teto maior, ver
// ImportFilmowRequestSchema) — mantido como segunda camada de proteção
// contra rate limit da TMDB nesse caso.
const CONCURRENCY = 3;

// Sem heurística de desambiguação: pega o 1º resultado da busca por texto
// na TMDB (já ordenado por relevância/popularidade) — o Filmow só exporta
// o título, sem ano nem outro dado pra desempatar. Título sem nenhum
// resultado (ou erro de rede) vira "not_found"/"error" pro usuário
// resolver manualmente depois.
async function importOne(
  env: Env,
  db: Db,
  userId: string,
  title: string,
): Promise<ImportFilmowResult> {
  const trimmed = title.trim();
  if (!trimmed) {
    return { title, status: "not_found", movie: null };
  }

  try {
    const [top] = await tmdbSearchMovies(env, trimmed, 1);
    if (!top) {
      return { title, status: "not_found", movie: null };
    }

    await upsertMovieEntry(
      env,
      db,
      userId,
      top.id,
      { status: "watched" },
      { logActivity: false, fetchCredits: false, fetchOverviewFallback: false },
    );
    return { title, status: "imported", movie: mapTmdbSearchResultToSummary(top) };
  } catch {
    return { title, status: "error", movie: null };
  }
}

export async function importFilmowTitles(
  env: Env,
  db: Db,
  userId: string,
  titles: string[],
): Promise<ImportFilmowResult[]> {
  const results: ImportFilmowResult[] = new Array<ImportFilmowResult>(titles.length);

  let cursor = 0;
  async function worker() {
    while (cursor < titles.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await importOne(env, db, userId, titles[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, titles.length) }, () => worker()));

  return results;
}

// Chamada 1x pelo front ao final do loop de import (ver
// ImportFilmowCsv.tsx), não por título — cada `importOne` roda com
// logActivity: false de propósito (evita floodar o feed), então essa é a
// única entrada de activity que o import gera: um resumo agregado.
// itemId/itemHref não apontam pra um filme real (o import cobre vários) —
// só o suficiente pro card do feed fazer sentido.
export async function logFilmowImportActivity(
  db: Db,
  userId: string,
  importedCount: number,
): Promise<void> {
  if (importedCount <= 0) {
    return;
  }

  await db.insert(activity).values({
    userId,
    mediaType: "movies",
    itemId: crypto.randomUUID(),
    itemTitle: `${importedCount} ${importedCount === 1 ? "filme" : "filmes"}`,
    itemHref: "/filmes/marcacoes?status=watched",
    itemCoverUrl: null,
    type: "imported",
    metadata: { source: "filmow", count: importedCount },
  });
}

// Busca os filmes assistidos + notas do Trakt (só perfil público — ver
// integrations/trakt/client.ts) e junta os dois por tmdb_id, sem nenhuma
// chamada à TMDB nesse passo (o Trakt já entrega o id pronto, diferente do
// Filmow, que precisa buscar por texto). null quando o perfil está privado
// ou não existe — a rota trata isso como "perfil indisponível".
export async function getTraktMoviesToImport(
  env: Env,
  username: string,
): Promise<TraktMoviesPreviewResponse | null> {
  const [watched, ratings] = await Promise.all([
    getWatchedMovies(env, username),
    getMovieRatings(env, username),
  ]);
  if (!watched) {
    return null;
  }

  const ratingByTmdbId = new Map<number, number>();
  for (const entry of ratings ?? []) {
    const tmdbId = entry.movie.ids.tmdb;
    if (tmdbId) {
      ratingByTmdbId.set(tmdbId, toCqntrackRating(entry.rating));
    }
  }

  const importable: TraktImportableMovie[] = [];
  const notFound: { title: string }[] = [];
  for (const entry of watched) {
    const tmdbId = entry.movie.ids.tmdb;
    if (!tmdbId) {
      notFound.push({ title: entry.movie.title });
      continue;
    }
    importable.push({
      tmdbId,
      title: entry.movie.title,
      rating: ratingByTmdbId.get(tmdbId) ?? null,
    });
  }

  return { importable, notFound };
}

// Mesmo espírito de importOne (Filmow), mas sem busca por texto — o
// tmdb_id já vem resolvido pelo Trakt (ver getTraktMoviesToImport).
// `rating: null` (Trakt sem nota pra esse filme) fica de fora do patch de
// propósito — mandar `rating: null` explícito apagaria uma nota que o
// usuário já tivesse posto manualmente antes no cqntrack.
async function importTraktOne(
  env: Env,
  db: Db,
  userId: string,
  item: { tmdbId: number; title: string; rating: number | null },
): Promise<ImportTraktMovieResult> {
  try {
    await upsertMovieEntry(
      env,
      db,
      userId,
      item.tmdbId,
      { status: "watched", ...(item.rating !== null ? { rating: item.rating } : {}) },
      { logActivity: false, fetchCredits: false, fetchOverviewFallback: false },
    );
    return { tmdbId: item.tmdbId, title: item.title, status: "imported" };
  } catch {
    return { tmdbId: item.tmdbId, title: item.title, status: "error" };
  }
}

export async function importTraktMovies(
  env: Env,
  db: Db,
  userId: string,
  items: { tmdbId: number; title: string; rating: number | null }[],
): Promise<ImportTraktMovieResult[]> {
  const results: ImportTraktMovieResult[] = new Array<ImportTraktMovieResult>(items.length);

  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await importTraktOne(env, db, userId, items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker()));

  return results;
}

// Mesmo racional de logFilmowImportActivity — resumo agregado, não 1 por
// filme (import roda com logActivity: false, ver importTraktOne acima).
export async function logTraktMoviesImportActivity(
  db: Db,
  userId: string,
  importedCount: number,
): Promise<void> {
  if (importedCount <= 0) {
    return;
  }

  await db.insert(activity).values({
    userId,
    mediaType: "movies",
    itemId: crypto.randomUUID(),
    itemTitle: `${importedCount} ${importedCount === 1 ? "filme" : "filmes"}`,
    itemHref: "/filmes/marcacoes?status=watched",
    itemCoverUrl: null,
    type: "imported",
    metadata: { source: "trakt", count: importedCount },
  });
}

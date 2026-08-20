import type {
  ImportCinopsysMovie,
  ImportCinopsysMovieResult,
  ImportFilmowResult,
  MovieStatus,
} from "@cqntrack/shared";
import { and, eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, movieEntry } from "../db/schema";
import { searchMovies as tmdbSearchMovies } from "../integrations/tmdb/movies";
import { upsertMovieEntry } from "./entries.service";
import { mapTmdbSearchResultToSummary } from "./movies.service";

type Db = ReturnType<typeof createDb>;

// Pulado antes de chamar upsertMovieEntry sempre que o filme já está no
// status pedido — sem isso, todo reimport reescreveria watchedAt pra agora
// (upsertMovieEntry não distingue "status igual ao que já tinha" de "status
// novo") e ainda chamaria a TMDB de novo à toa: getOrCacheMovie considera
// qualquer linha com cast===null sempre desatualizada (ver isStale em
// movies.service.ts), e o import roda com fetchCredits:false de propósito,
// então cast nunca deixa de ser null por causa do próprio import.
async function alreadyHasStatus(
  db: Db,
  userId: string,
  tmdbId: number,
  status: MovieStatus,
): Promise<boolean> {
  const existing = await db.query.movieEntry.findFirst({
    where: and(eq(movieEntry.userId, userId), eq(movieEntry.movieId, tmdbId)),
    columns: { status: true },
  });
  return existing?.status === status;
}

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

    if (await alreadyHasStatus(db, userId, top.id, "watched")) {
      return { title, status: "imported", movie: mapTmdbSearchResultToSummary(top) };
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

// Mesmo espírito de importOne (Filmow), mas sem busca por texto — o
// tmdbId já vem resolvido no backup do Cinopsys, processado no navegador
// (ver ImportCinopsysJson.tsx). Sem rating: o backup só tem a nota agregada
// da própria TMDB, não uma nota pessoal do usuário.
async function importCinopsysOne(
  env: Env,
  db: Db,
  userId: string,
  item: ImportCinopsysMovie,
): Promise<ImportCinopsysMovieResult> {
  try {
    if (await alreadyHasStatus(db, userId, item.tmdbId, item.status)) {
      return { tmdbId: item.tmdbId, title: item.title, status: "imported" };
    }

    await upsertMovieEntry(
      env,
      db,
      userId,
      item.tmdbId,
      { status: item.status },
      { logActivity: false, fetchCredits: false, fetchOverviewFallback: false },
    );
    return { tmdbId: item.tmdbId, title: item.title, status: "imported" };
  } catch {
    return { tmdbId: item.tmdbId, title: item.title, status: "error" };
  }
}

export async function importCinopsysMovies(
  env: Env,
  db: Db,
  userId: string,
  movies: ImportCinopsysMovie[],
): Promise<ImportCinopsysMovieResult[]> {
  const results: ImportCinopsysMovieResult[] = new Array<ImportCinopsysMovieResult>(movies.length);

  let cursor = 0;
  async function worker() {
    while (cursor < movies.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await importCinopsysOne(env, db, userId, movies[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, movies.length) }, () => worker()));

  return results;
}

// Mesmo racional de logFilmowImportActivity — resumo agregado, não 1 por
// filme (import roda com logActivity: false, ver importCinopsysOne acima).
export async function logCinopsysMoviesImportActivity(
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
    metadata: { source: "cinopsys", count: importedCount },
  });
}

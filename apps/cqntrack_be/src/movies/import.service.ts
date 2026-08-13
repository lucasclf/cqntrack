import type { ImportFilmowResult } from "@cqntrack/shared";
import type { createDb } from "../db/client";
import { searchMovies as tmdbSearchMovies } from "../integrations/tmdb/movies";
import { upsertMovieEntry } from "./entries.service";
import { mapTmdbSearchResultToSummary } from "./movies.service";

type Db = ReturnType<typeof createDb>;

// Concorrência baixa — cada título novo já dispara ~3 requests à TMDB
// dentro de upsertMovieEntry (busca + detalhe + créditos, via
// getOrCacheMovie); um lote inteiro em paralelo estouraria tanto o rate
// limit da TMDB quanto o limite de subrequests do Worker. O front já manda
// em lotes pequenos (ver ImportFilmowRequestSchema) — isso aqui é a
// segunda camada de controle, dentro de cada lote.
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

    await upsertMovieEntry(env, db, userId, top.id, { status: "watched" }, { logActivity: false });
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

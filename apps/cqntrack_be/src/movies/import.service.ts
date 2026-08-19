import type { ImportFilmowResult } from "@cqntrack/shared";
import type { createDb } from "../db/client";
import { activity } from "../db/schema";
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

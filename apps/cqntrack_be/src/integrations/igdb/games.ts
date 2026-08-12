import type { createDb } from "../../db/client";
import { igdbFetch } from "./client";
import type { IgdbGame } from "./types";

type Db = ReturnType<typeof createDb>;

// Escapa aspas/barras antes de interpolar na query Apicalypse (que não é JSON).
function escapeApicalypseString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function searchGames(
  env: Env,
  db: Db,
  query: string,
  limit = 20,
): Promise<IgdbGame[]> {
  const safeQuery = escapeApicalypseString(query.slice(0, 100));
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const body = `fields name,slug,cover.image_id,first_release_date,platforms.name,genres.name,total_rating; search "${safeQuery}"; limit ${safeLimit};`;
  return igdbFetch<IgdbGame[]>(env, db, "games", body);
}

export async function getGameById(env: Env, db: Db, igdbId: number): Promise<IgdbGame | null> {
  const body = `fields name,slug,summary,total_rating,first_release_date,genres.name,platforms.name,cover.image_id; where id = ${igdbId};`;
  const [found] = await igdbFetch<IgdbGame[]>(env, db, "games", body);
  return found ?? null;
}

const DISCOVER_PAGE_SIZE = 20;
// Piso de avaliações — sem isso, um jogo obscuro com 1 nota 100 apareceria
// antes de clássicos aclamados por milhares de pessoas (confirmado contra a
// API real durante o planejamento: com esse piso, os primeiros resultados
// já são jogos de verdade aclamados, tipo The Witcher 3/Zelda ALttP).
const DISCOVER_MIN_RATING_COUNT = 500;

// Sem cache (mesmo espírito de busca) — a lista de populares muda pouco de
// um dia pro outro, mas paginar sobre um cache próprio seria complexidade
// desnecessária pra esse volume de tráfego.
export async function getPopularGames(env: Env, db: Db, page = 1): Promise<IgdbGame[]> {
  const safePage = Math.max(page, 1);
  const offset = (safePage - 1) * DISCOVER_PAGE_SIZE;
  const body = `fields name,slug,cover.image_id,first_release_date,platforms.name,genres.name,total_rating; where total_rating_count > ${DISCOVER_MIN_RATING_COUNT}; sort total_rating desc; limit ${DISCOVER_PAGE_SIZE}; offset ${offset};`;
  return igdbFetch<IgdbGame[]>(env, db, "games", body);
}

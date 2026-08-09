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

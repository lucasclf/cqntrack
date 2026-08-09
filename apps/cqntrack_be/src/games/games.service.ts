import type { GameSummary } from "@cqntrack/shared";
import type { createDb } from "../db/client";
import { searchGames as igdbSearchGames } from "../integrations/igdb/games";
import { buildCoverUrl, type IgdbGame } from "../integrations/igdb/types";

type Db = ReturnType<typeof createDb>;

// IGDB devolve first_release_date em segundos unix; nosso DTO usa data ISO
// (yyyy-mm-dd), então convertemos aqui — nunca expor o formato bruto da IGDB.
export function mapIgdbGameToSummary(game: IgdbGame): GameSummary {
  return {
    igdbId: game.id,
    name: game.name,
    coverUrl: game.cover ? buildCoverUrl(game.cover.image_id, "cover_big") : null,
    firstReleaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
      : null,
    platforms: game.platforms?.map((platform) => platform.name) ?? [],
    genres: game.genres?.map((genre) => genre.name) ?? [],
    rating: game.total_rating ?? null,
  };
}

export async function searchGamesForUser(
  env: Env,
  db: Db,
  query: string,
  limit: number,
): Promise<GameSummary[]> {
  const games = await igdbSearchGames(env, db, query, limit);
  return games.map(mapIgdbGameToSummary);
}

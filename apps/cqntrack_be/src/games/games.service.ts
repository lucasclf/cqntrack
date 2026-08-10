import type { GameSummary } from "@cqntrack/shared";
import { eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { game } from "../db/schema";
import { getGameById, searchGames as igdbSearchGames } from "../integrations/igdb/games";
import { buildCoverUrl, type IgdbGame } from "../integrations/igdb/types";

type Db = ReturnType<typeof createDb>;
export type CachedGame = typeof game.$inferSelect;

// Campos de snapshot pra gravar na tabela genérica `activity` — jogos são a
// única seção "mediaType" implementada até agora, mas o formato do snapshot
// já é o mesmo que qualquer seção futura vai preencher.
export function toActivitySnapshot(cachedGame: CachedGame) {
  return {
    mediaType: "games" as const,
    itemId: String(cachedGame.igdbId),
    itemTitle: cachedGame.name,
    itemHref: `/jogos/${cachedGame.igdbId}`,
    itemCoverUrl: cachedGame.coverImageId ? buildCoverUrl(cachedGame.coverImageId, "cover_big") : null,
  };
}

export class GameNotFoundError extends Error {
  constructor(public readonly igdbId: number) {
    super(`Jogo ${igdbId} não encontrado na IGDB`);
    this.name = "GameNotFoundError";
  }
}

// IGDB devolve first_release_date em segundos unix; nosso DTO usa data ISO
// (yyyy-mm-dd), então convertemos aqui — nunca expor o formato bruto da IGDB.
export function mapIgdbGameToSummary(igdbGame: IgdbGame): GameSummary {
  return {
    igdbId: igdbGame.id,
    name: igdbGame.name,
    coverUrl: igdbGame.cover ? buildCoverUrl(igdbGame.cover.image_id, "cover_big") : null,
    firstReleaseDate: igdbGame.first_release_date
      ? new Date(igdbGame.first_release_date * 1000).toISOString().slice(0, 10)
      : null,
    platforms: igdbGame.platforms?.map((platform) => platform.name) ?? [],
    genres: igdbGame.genres?.map((genre) => genre.name) ?? [],
    rating: igdbGame.total_rating ?? null,
  };
}

// Mesma forma de mapIgdbGameToSummary, mas a partir de uma linha já cacheada
// no D1 (game), usada por qualquer rota que leia jogos do próprio banco em
// vez de consultar a IGDB de novo (detalhe, "minhas marcações", listas etc.).
export function mapCachedGameToSummary(row: CachedGame): GameSummary {
  return {
    igdbId: row.igdbId,
    name: row.name,
    coverUrl: row.coverImageId ? buildCoverUrl(row.coverImageId, "cover_big") : null,
    firstReleaseDate: row.firstReleaseDate ? row.firstReleaseDate.toISOString().slice(0, 10) : null,
    platforms: row.platforms ?? [],
    genres: row.genres ?? [],
    rating: row.rating,
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

// Busca o jogo no cache local (game); se não existir, consulta a IGDB e
// cacheia antes de devolver. `onConflictDoNothing` torna isso seguro sob
// requests concorrentes cacheando o mesmo jogo pela primeira vez.
export async function getOrCacheGame(env: Env, db: Db, igdbId: number): Promise<CachedGame> {
  const [cached] = await db.select().from(game).where(eq(game.igdbId, igdbId));
  if (cached) {
    return cached;
  }

  const igdbGame = await getGameById(env, db, igdbId);
  if (!igdbGame) {
    throw new GameNotFoundError(igdbId);
  }

  await db
    .insert(game)
    .values({
      igdbId: igdbGame.id,
      slug: igdbGame.slug,
      name: igdbGame.name,
      coverImageId: igdbGame.cover?.image_id ?? null,
      firstReleaseDate: igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date * 1000)
        : null,
      summary: igdbGame.summary ?? null,
      genres: igdbGame.genres?.map((genre) => genre.name) ?? [],
      platforms: igdbGame.platforms?.map((platform) => platform.name) ?? [],
      rating: igdbGame.total_rating ?? null,
    })
    .onConflictDoNothing();

  const [inserted] = await db.select().from(game).where(eq(game.igdbId, igdbId));
  if (!inserted) {
    // Não deveria acontecer (acabamos de inserir, ou outra request concorrente
    // já tinha inserido) — só pra manter o tipo de retorno não-nulo com segurança.
    throw new GameNotFoundError(igdbId);
  }
  return inserted;
}

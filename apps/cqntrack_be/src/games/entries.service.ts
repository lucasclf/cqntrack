import type { GameEntry, GameEntryWithGame, ListGameEntriesQuery, UpsertGameEntryRequest } from "@cqntrack/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { gameActivity, gameEntry } from "../db/schema";
import { withoutUndefined } from "../lib/without-undefined";
import { getOrCacheGame, mapCachedGameToSummary } from "./games.service";

type Db = ReturnType<typeof createDb>;
type GameEntryRow = typeof gameEntry.$inferSelect;

// Limite de produto: favoritos são uma vitrine curada, não uma segunda lista
// genérica — no máximo 4 por usuário.
export const MAX_FAVORITE_GAMES = 4;

export class TooManyFavoritesError extends Error {
  constructor() {
    super(`Limite de ${MAX_FAVORITE_GAMES} jogos favoritos atingido`);
    this.name = "TooManyFavoritesError";
  }
}

const SORT_COLUMNS = {
  status: gameEntry.status,
  rating: gameEntry.rating,
  favorite: gameEntry.favorite,
  // Ordena pelo texto JSON bruto da lista — não é uma ordem alfabética
  // "correta" por nome de plataforma, mas é determinística e não vale a
  // complexidade extra de um ORDER BY custom pra isso.
  platform: gameEntry.platforms,
  updatedAt: gameEntry.updatedAt,
} as const;

function toGameEntry(row: GameEntryRow): GameEntry {
  return {
    id: row.id,
    status: row.status,
    rating: row.rating,
    favorite: row.favorite,
    platforms: row.platforms,
    review: row.review,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function logGameEntryActivities(
  db: Db,
  userId: string,
  gameId: number,
  input: UpsertGameEntryRequest,
): Promise<void> {
  const activities: (typeof gameActivity.$inferInsert)[] = [];

  // Só loga quando um status real é definido — desmarcar (status: null),
  // como desfavoritar, não vira atividade no feed.
  if (input.status !== undefined && input.status !== null) {
    activities.push({ userId, gameId, type: "status_changed", metadata: { status: input.status } });
  }
  if (input.favorite === true) {
    activities.push({ userId, gameId, type: "favorited" });
  }
  if (input.rating !== undefined && input.rating !== null) {
    activities.push({ userId, gameId, type: "rated", metadata: { rating: input.rating } });
  }
  if (input.review !== undefined && input.review !== null && input.review.trim() !== "") {
    activities.push({ userId, gameId, type: "reviewed" });
  }

  if (activities.length > 0) {
    await db.insert(gameActivity).values(activities);
  }
}

export async function getGameEntryForUser(
  db: Db,
  userId: string,
  igdbId: number,
): Promise<GameEntry | null> {
  const row = await db.query.gameEntry.findFirst({
    where: and(eq(gameEntry.userId, userId), eq(gameEntry.gameId, igdbId)),
  });
  return row ? toGameEntry(row) : null;
}

export async function upsertGameEntry(
  env: Env,
  db: Db,
  userId: string,
  igdbId: number,
  input: UpsertGameEntryRequest,
): Promise<GameEntry> {
  await getOrCacheGame(env, db, igdbId); // garante que a FK gameId existe

  const existing = await db.query.gameEntry.findFirst({
    where: and(eq(gameEntry.userId, userId), eq(gameEntry.gameId, igdbId)),
  });

  // Só checa o limite quando o favorito está de fato virando true agora —
  // reenviar favorite: true pra um jogo já favoritado não deve contar.
  if (input.favorite === true && existing?.favorite !== true) {
    const [favoriteCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(gameEntry)
      .where(and(eq(gameEntry.userId, userId), eq(gameEntry.favorite, true)));
    if ((favoriteCount?.count ?? 0) >= MAX_FAVORITE_GAMES) {
      throw new TooManyFavoritesError();
    }
  }

  const patch = withoutUndefined({
    status: input.status,
    rating: input.rating,
    favorite: input.favorite,
    platforms: input.platforms,
    review: input.review,
  });

  const [row] = existing
    ? await db.update(gameEntry).set(patch).where(eq(gameEntry.id, existing.id)).returning()
    : await db.insert(gameEntry).values({ userId, gameId: igdbId, ...patch }).returning();

  if (!row) {
    throw new Error("Falha ao gravar a marcação do jogo");
  }

  await logGameEntryActivities(db, userId, igdbId, input);

  return toGameEntry(row);
}

export async function setGameFavorite(
  env: Env,
  db: Db,
  userId: string,
  igdbId: number,
  favorite: boolean,
): Promise<GameEntry> {
  return upsertGameEntry(env, db, userId, igdbId, { favorite });
}

export async function deleteGameEntry(db: Db, userId: string, igdbId: number): Promise<void> {
  await db.delete(gameEntry).where(and(eq(gameEntry.userId, userId), eq(gameEntry.gameId, igdbId)));
}

export async function listGameEntries(
  db: Db,
  userId: string,
  query: ListGameEntriesQuery,
): Promise<{ items: GameEntryWithGame[]; total: number }> {
  const conditions = [eq(gameEntry.userId, userId)];
  if (query.status) {
    conditions.push(eq(gameEntry.status, query.status));
  }
  if (query.favorite !== undefined) {
    conditions.push(eq(gameEntry.favorite, query.favorite));
  }
  if (query.platform) {
    // platforms é uma lista JSON — filtra entries que contêm essa plataforma.
    conditions.push(
      sql`EXISTS (SELECT 1 FROM json_each(${gameEntry.platforms}) WHERE json_each.value = ${query.platform})`,
    );
  }
  const where = and(...conditions);

  const sortColumn = SORT_COLUMNS[query.sortBy];
  const orderBy = query.order === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [rows, countResult] = await Promise.all([
    db.query.gameEntry.findMany({
      where,
      orderBy,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      with: { game: true },
    }),
    db.select({ count: sql<number>`count(*)` }).from(gameEntry).where(where),
  ]);

  return {
    items: rows.map((row) => ({
      ...toGameEntry(row),
      game: mapCachedGameToSummary(row.game),
    })),
    total: countResult[0]?.count ?? 0,
  };
}

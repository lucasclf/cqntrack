import type {
  GameEntry,
  GameEntryWithGame,
  ListGameEntriesQuery,
  UpsertGameEntryRequest,
} from "@cqntrack/shared";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, gameEntry } from "../db/schema";
import { withoutUndefined } from "../lib/without-undefined";
import {
  type CachedGame,
  getOrCacheGame,
  mapCachedGameToSummary,
  toActivitySnapshot,
} from "./games.service";

type Db = ReturnType<typeof createDb>;
type GameEntryRow = typeof gameEntry.$inferSelect;

const SORT_COLUMNS = {
  status: gameEntry.status,
  rating: gameEntry.rating,
  favorite: gameEntry.favoritedAt,
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
    favoritedAt: row.favoritedAt?.toISOString() ?? null,
    platforms: row.platforms,
    review: row.review,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function logGameEntryActivities(
  db: Db,
  userId: string,
  cachedGame: CachedGame,
  input: UpsertGameEntryRequest,
): Promise<void> {
  const snapshot = toActivitySnapshot(cachedGame);
  const activities: (typeof activity.$inferInsert)[] = [];

  // Só loga quando um status real é definido — desmarcar (status: null),
  // como desfavoritar, não vira atividade no feed.
  if (input.status !== undefined && input.status !== null) {
    activities.push({
      userId,
      ...snapshot,
      type: "status_changed",
      metadata: { status: input.status },
    });
  }
  if (input.rating !== undefined && input.rating !== null) {
    activities.push({ userId, ...snapshot, type: "rated", metadata: { rating: input.rating } });
  }
  if (input.review !== undefined && input.review !== null && input.review.trim() !== "") {
    activities.push({ userId, ...snapshot, type: "reviewed" });
  }
  // Só ao favoritar — desfavoritar não vira atividade.
  if (input.favorited === true) {
    activities.push({ userId, ...snapshot, type: "favorited" });
  }

  if (activities.length > 0) {
    await db.insert(activity).values(activities);
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
  const cachedGame = await getOrCacheGame(env, db, igdbId); // garante que a FK gameId existe

  const existing = await db.query.gameEntry.findFirst({
    where: and(eq(gameEntry.userId, userId), eq(gameEntry.gameId, igdbId)),
  });

  const patch = withoutUndefined({
    status: input.status,
    rating: input.rating,
    platforms: input.platforms,
    review: input.review,
    favoritedAt: input.favorited === undefined ? undefined : input.favorited ? new Date() : null,
  });

  const [row] = existing
    ? await db.update(gameEntry).set(patch).where(eq(gameEntry.id, existing.id)).returning()
    : await db
        .insert(gameEntry)
        .values({ userId, gameId: igdbId, ...patch })
        .returning();

  if (!row) {
    throw new Error("Falha ao gravar a marcação do jogo");
  }

  await logGameEntryActivities(db, userId, cachedGame, input);

  return toGameEntry(row);
}

// Sem limite de quantidade — todo jogo com favoritedAt preenchido, mais
// recente primeiro.
export async function getFavorites(db: Db, userId: string): Promise<GameEntryWithGame[]> {
  const rows = await db.query.gameEntry.findMany({
    where: and(eq(gameEntry.userId, userId), isNotNull(gameEntry.favoritedAt)),
    orderBy: desc(gameEntry.favoritedAt),
    with: { game: true },
  });

  return rows.map((row) => ({ ...toGameEntry(row), game: mapCachedGameToSummary(row.game) }));
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
    conditions.push(
      query.favorite ? isNotNull(gameEntry.favoritedAt) : isNull(gameEntry.favoritedAt),
    );
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
    db
      .select({ count: sql<number>`count(*)` })
      .from(gameEntry)
      .where(where),
  ]);

  return {
    items: rows.map((row) => ({
      ...toGameEntry(row),
      game: mapCachedGameToSummary(row.game),
    })),
    total: countResult[0]?.count ?? 0,
  };
}

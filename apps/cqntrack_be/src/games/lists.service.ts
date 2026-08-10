import type { CreateGameListRequest, GameList, GameListDetail, UpdateGameListRequest } from "@cqntrack/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, gameList, gameListItem } from "../db/schema";
import { withoutUndefined } from "../lib/without-undefined";
import { getOrCacheGame, mapCachedGameToSummary, toActivitySnapshot } from "./games.service";

type Db = ReturnType<typeof createDb>;
type GameListRow = typeof gameList.$inferSelect;

export class GameListNotFoundError extends Error {
  constructor(public readonly listId: string) {
    super(`Lista ${listId} não encontrada`);
    this.name = "GameListNotFoundError";
  }
}

export class DuplicateGameListNameError extends Error {
  constructor(public readonly name: string) {
    super(`Já existe uma lista chamada "${name}"`);
    this.name = "DuplicateGameListNameError";
  }
}

// O D1/drizzle envolve o erro real do SQLite numa cadeia de `cause`
// (DrizzleQueryError -> D1_ERROR -> SQLITE_CONSTRAINT) — precisa percorrer
// a cadeia toda, checar só error.message não é suficiente.
function isUniqueConstraintError(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current.message.includes("UNIQUE constraint failed")) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

async function withItemCount(db: Db, rows: GameListRow[]): Promise<GameList[]> {
  if (rows.length === 0) {
    return [];
  }

  const counts = await db
    .select({ listId: gameListItem.listId, count: sql<number>`count(*)` })
    .from(gameListItem)
    .where(
      inArray(
        gameListItem.listId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(gameListItem.listId);
  const countByListId = new Map(counts.map((row) => [row.listId, row.count]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: countByListId.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

// Garante que a lista existe E pertence ao usuário — usado por toda operação
// de escrita/leitura de detalhe, pra nunca vazar/alterar lista de outra conta.
async function getOwnedGameList(db: Db, userId: string, listId: string): Promise<GameListRow> {
  const [row] = await db
    .select()
    .from(gameList)
    .where(and(eq(gameList.id, listId), eq(gameList.userId, userId)));
  if (!row) {
    throw new GameListNotFoundError(listId);
  }
  return row;
}

export async function listGameLists(db: Db, userId: string): Promise<GameList[]> {
  const rows = await db
    .select()
    .from(gameList)
    .where(eq(gameList.userId, userId))
    .orderBy(desc(gameList.updatedAt));
  return withItemCount(db, rows);
}

export async function createGameList(
  db: Db,
  userId: string,
  input: CreateGameListRequest,
): Promise<GameList> {
  try {
    const [row] = await db
      .insert(gameList)
      .values({ userId, name: input.name, description: input.description ?? null })
      .returning();
    if (!row) {
      throw new Error("Falha ao criar lista");
    }
    const [list] = await withItemCount(db, [row]);
    return list!;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateGameListNameError(input.name);
    }
    throw error;
  }
}

export async function updateGameList(
  db: Db,
  userId: string,
  listId: string,
  input: UpdateGameListRequest,
): Promise<GameList> {
  await getOwnedGameList(db, userId, listId);

  const patch = withoutUndefined({ name: input.name, description: input.description });

  try {
    const [row] =
      Object.keys(patch).length > 0
        ? await db.update(gameList).set(patch).where(eq(gameList.id, listId)).returning()
        : await db.select().from(gameList).where(eq(gameList.id, listId));
    if (!row) {
      throw new Error("Falha ao atualizar lista");
    }
    const [list] = await withItemCount(db, [row]);
    return list!;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateGameListNameError(input.name ?? "");
    }
    throw error;
  }
}

export async function deleteGameList(db: Db, userId: string, listId: string): Promise<void> {
  await getOwnedGameList(db, userId, listId);
  await db.delete(gameList).where(eq(gameList.id, listId));
}

export async function getGameListDetail(
  db: Db,
  userId: string,
  listId: string,
): Promise<GameListDetail> {
  const row = await getOwnedGameList(db, userId, listId);

  const items = await db.query.gameListItem.findMany({
    where: eq(gameListItem.listId, listId),
    orderBy: desc(gameListItem.addedAt),
    with: { game: true },
  });

  const [list] = await withItemCount(db, [row]);
  return {
    ...list!,
    items: items.map((item) => mapCachedGameToSummary(item.game)),
  };
}

export async function addGameToList(
  env: Env,
  db: Db,
  userId: string,
  listId: string,
  igdbId: number,
): Promise<void> {
  const list = await getOwnedGameList(db, userId, listId);
  const cachedGame = await getOrCacheGame(env, db, igdbId); // garante a FK gameId

  const inserted = await db
    .insert(gameListItem)
    .values({ listId, gameId: igdbId })
    .onConflictDoNothing()
    .returning();

  // Só loga atividade se o jogo realmente entrou agora (evita duplicar o
  // registro quando o jogo já estava na lista).
  if (inserted.length > 0) {
    await db.insert(activity).values({
      userId,
      ...toActivitySnapshot(cachedGame),
      type: "added_to_list",
      metadata: { listId, listName: list.name },
    });
  }
}

export async function removeGameFromList(
  db: Db,
  userId: string,
  listId: string,
  igdbId: number,
): Promise<void> {
  await getOwnedGameList(db, userId, listId);
  await db
    .delete(gameListItem)
    .where(and(eq(gameListItem.listId, listId), eq(gameListItem.gameId, igdbId)));
}

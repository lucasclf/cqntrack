import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "../client";
import { game, gameEntry, gameList, gameListItem, user } from "./index";

type Db = ReturnType<typeof createDb>;

async function createTestUser(db: Db): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(user).values({
    id,
    name: "Teste",
    email: `teste-${crypto.randomUUID()}@cqntrack.dev`,
  });
  return id;
}

async function createTestGame(db: Db, igdbId: number): Promise<void> {
  await db.insert(game).values({ igdbId, slug: `jogo-${igdbId}`, name: `Jogo ${igdbId}` });
}

describe("schema de jogos", () => {
  it("cria uma marcação vinculada a um usuário e a um jogo cacheado", async () => {
    const db = createDb(env);
    const userId = await createTestUser(db);
    await createTestGame(db, 1);

    await db.insert(gameEntry).values({ userId, gameId: 1, status: "playing", favorite: true });

    const [entry] = await db.select().from(gameEntry).where(eq(gameEntry.userId, userId));
    expect(entry?.status).toBe("playing");
    expect(entry?.favorite).toBe(true);
  });

  it("impede duas marcações do mesmo jogo pelo mesmo usuário", async () => {
    const db = createDb(env);
    const userId = await createTestUser(db);
    await createTestGame(db, 2);

    await db.insert(gameEntry).values({ userId, gameId: 2 });

    await expect(db.insert(gameEntry).values({ userId, gameId: 2 })).rejects.toThrow();
  });

  it("cascateia a exclusão do usuário para marcações e listas dele", async () => {
    const db = createDb(env);
    const userId = await createTestUser(db);
    await createTestGame(db, 3);

    await db.insert(gameEntry).values({ userId, gameId: 3 });
    const [list] = await db.insert(gameList).values({ userId, name: "Quero jogar" }).returning();
    await db.insert(gameListItem).values({ listId: list!.id, gameId: 3 });

    await db.delete(user).where(eq(user.id, userId));

    const remainingEntries = await db.select().from(gameEntry).where(eq(gameEntry.userId, userId));
    const remainingLists = await db.select().from(gameList).where(eq(gameList.userId, userId));
    expect(remainingEntries).toHaveLength(0);
    expect(remainingLists).toHaveLength(0);
  });

  it("mantém o cache do jogo mesmo depois do usuário ser excluído", async () => {
    const db = createDb(env);
    const userId = await createTestUser(db);
    await createTestGame(db, 4);
    await db.insert(gameEntry).values({ userId, gameId: 4 });

    await db.delete(user).where(eq(user.id, userId));

    const [cachedGame] = await db.select().from(game).where(eq(game.igdbId, 4));
    expect(cachedGame).toBeDefined();
  });
});

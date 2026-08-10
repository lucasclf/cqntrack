import type { PublicProfile } from "@cqntrack/shared";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { gameEntry, user } from "../db/schema";

type Db = ReturnType<typeof createDb>;

export class UserNotFoundError extends Error {
  constructor(public readonly username: string) {
    super(`Usuário ${username} não encontrado`);
    this.name = "UserNotFoundError";
  }
}

// Resolve username -> userId — usado por toda rota pública que reaproveita
// os services de jogos/listas (que operam por userId, não por username).
export async function resolveUserIdByUsername(db: Db, username: string): Promise<string> {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.username, username));
  if (!row) {
    throw new UserNotFoundError(username);
  }
  return row.id;
}

export async function getPublicProfile(db: Db, username: string): Promise<PublicProfile> {
  const [row] = await db
    .select({
      id: user.id,
      username: user.username,
      displayUsername: user.displayUsername,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.username, username));
  if (!row || !row.username) {
    throw new UserNotFoundError(username);
  }

  const statusCounts = await db
    .select({ status: gameEntry.status, count: sql<number>`count(*)` })
    .from(gameEntry)
    .where(eq(gameEntry.userId, row.id))
    .groupBy(gameEntry.status);

  const [favoritesRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(gameEntry)
    .where(and(eq(gameEntry.userId, row.id), isNotNull(gameEntry.favoriteSlot)));

  const countByStatus = new Map(statusCounts.map((entry) => [entry.status, entry.count]));
  const total = statusCounts.reduce((sum, entry) => sum + entry.count, 0);

  return {
    username: row.username,
    displayUsername: row.displayUsername ?? row.username,
    memberSince: row.createdAt.toISOString(),
    stats: {
      total,
      completed: countByStatus.get("completed") ?? 0,
      playing: countByStatus.get("playing") ?? 0,
      platinum: countByStatus.get("platinum") ?? 0,
      favorites: favoritesRow?.count ?? 0,
    },
  };
}

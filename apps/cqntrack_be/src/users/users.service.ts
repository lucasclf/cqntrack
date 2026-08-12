import type { PublicProfile } from "@cqntrack/shared";
import { eq } from "drizzle-orm";
import type { createDb } from "../db/client";
import { user } from "../db/schema";

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
      image: user.image,
    })
    .from(user)
    .where(eq(user.username, username));
  if (!row || !row.username) {
    throw new UserNotFoundError(username);
  }

  return {
    username: row.username,
    displayUsername: row.displayUsername ?? row.username,
    memberSince: row.createdAt.toISOString(),
    image: row.image ?? null,
  };
}

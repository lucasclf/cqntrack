import type { ActivityItem, ListActivityQuery } from "@cqntrack/shared";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, follow, user } from "../db/schema";
import { resolveUserIdByUsername } from "../users/users.service";

type Db = ReturnType<typeof createDb>;

export class SelfFollowError extends Error {
  constructor() {
    super("Não é possível seguir a si mesmo");
    this.name = "SelfFollowError";
  }
}

export interface FollowedUser {
  username: string;
  displayUsername: string;
  image: string | null;
}

export interface FriendActivityItem extends ActivityItem {
  author: FollowedUser;
}

// Idempotente (onConflictDoNothing) — clicar "seguir" 2x, ou 2 requests
// concorrentes, não gera erro nem linha duplicada (o índice único garante
// isso no banco também, esta chamada só evita o round-trip de erro).
export async function followUser(db: Db, followerId: string, username: string): Promise<void> {
  const followeeId = await resolveUserIdByUsername(db, username);
  if (followeeId === followerId) {
    throw new SelfFollowError();
  }
  await db.insert(follow).values({ followerId, followeeId }).onConflictDoNothing();
}

// Idempotente — deixar de seguir alguém que já não se seguia não é erro.
export async function unfollowUser(db: Db, followerId: string, username: string): Promise<void> {
  const followeeId = await resolveUserIdByUsername(db, username);
  await db
    .delete(follow)
    .where(and(eq(follow.followerId, followerId), eq(follow.followeeId, followeeId)));
}

export async function getFollowStatus(
  db: Db,
  followerId: string,
  username: string,
): Promise<{ following: boolean }> {
  const followeeId = await resolveUserIdByUsername(db, username);
  const [row] = await db
    .select({ id: follow.id })
    .from(follow)
    .where(and(eq(follow.followerId, followerId), eq(follow.followeeId, followeeId)));
  return { following: !!row };
}

// Join explícito (não API relacional do Drizzle) — ver social.schema.ts
// sobre `follow` não ter `relations()`.
export async function listFollowing(db: Db, followerId: string): Promise<FollowedUser[]> {
  const rows = await db
    .select({
      username: user.username,
      displayUsername: user.displayUsername,
      image: user.image,
    })
    .from(follow)
    .innerJoin(user, eq(user.id, follow.followeeId))
    .where(eq(follow.followerId, followerId))
    .orderBy(desc(follow.createdAt));

  return rows.map((row) => ({
    username: row.username ?? "",
    displayUsername: row.displayUsername ?? row.username ?? "",
    image: row.image ?? null,
  }));
}

function toFriendActivityItem(
  row: typeof activity.$inferSelect & {
    user: { username: string | null; displayUsername: string | null; image: string | null };
  },
): FriendActivityItem {
  return {
    id: row.id,
    mediaType: row.mediaType,
    itemId: row.itemId,
    itemTitle: row.itemTitle,
    itemHref: row.itemHref,
    itemCoverUrl: row.itemCoverUrl,
    type: row.type,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    author: {
      username: row.user.username ?? "",
      displayUsername: row.user.displayUsername ?? row.user.username ?? "",
      image: row.user.image ?? null,
    },
  };
}

// Clone de listActivity (activity.service.ts), filtrando por uma lista de
// autores (quem eu sigo) em vez de um único userId, com o autor de cada
// item resolvido via `with` (API relacional — `activity` tem
// `activityRelations.user`, diferente de `follow`, que não tem
// `relations()`). `columns` restrito evita vazar `email`/outros campos
// sensíveis de `user` pra quem vê o feed.
export async function listFriendActivity(
  db: Db,
  followerId: string,
  query: ListActivityQuery,
): Promise<{ items: FriendActivityItem[]; nextCursor: string | null }> {
  const followingRows = await db
    .select({ followeeId: follow.followeeId })
    .from(follow)
    .where(eq(follow.followerId, followerId));
  const followingIds = followingRows.map((row) => row.followeeId);

  if (followingIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  const conditions = [inArray(activity.userId, followingIds)];
  if (query.before) {
    conditions.push(lt(activity.createdAt, new Date(query.before)));
  }
  if (query.mediaType) {
    conditions.push(eq(activity.mediaType, query.mediaType));
  }

  const rows = await db.query.activity.findMany({
    where: and(...conditions),
    orderBy: desc(activity.createdAt),
    limit: query.limit + 1,
    with: {
      user: { columns: { username: true, displayUsername: true, image: true } },
    },
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page.at(-1);

  return {
    items: page.map(toFriendActivityItem),
    nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
  };
}

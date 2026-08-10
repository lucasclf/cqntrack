import type { ActivityItem, GameStatus, ListActivityQuery } from "@cqntrack/shared";
import { and, desc, eq, lt } from "drizzle-orm";
import type { createDb } from "../db/client";
import { gameActivity } from "../db/schema";
import { mapCachedGameToSummary } from "./games.service";

type Db = ReturnType<typeof createDb>;
type ActivityRow = typeof gameActivity.$inferSelect & { game: Parameters<typeof mapCachedGameToSummary>[0] };

function toActivityItem(row: ActivityRow): ActivityItem {
  const base = {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    game: mapCachedGameToSummary(row.game),
  };

  switch (row.type) {
    case "status_changed":
      return { ...base, type: "status_changed", status: (row.metadata as { status: GameStatus }).status };
    case "rated":
      return { ...base, type: "rated", rating: (row.metadata as { rating: number }).rating };
    case "added_to_list": {
      const metadata = row.metadata as { listId: string; listName: string };
      return { ...base, type: "added_to_list", listId: metadata.listId, listName: metadata.listName };
    }
    case "favorited":
      return { ...base, type: "favorited" };
    case "reviewed":
      return { ...base, type: "reviewed" };
  }
}

export async function listActivity(
  db: Db,
  userId: string,
  query: ListActivityQuery,
): Promise<{ items: ActivityItem[]; nextCursor: string | null }> {
  const conditions = [eq(gameActivity.userId, userId)];
  if (query.before) {
    conditions.push(lt(gameActivity.createdAt, new Date(query.before)));
  }

  // Busca um item a mais só pra saber se existe próxima página.
  const rows = await db.query.gameActivity.findMany({
    where: and(...conditions),
    orderBy: desc(gameActivity.createdAt),
    limit: query.limit + 1,
    with: { game: true },
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page.at(-1);

  return {
    items: page.map(toActivityItem),
    nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
  };
}

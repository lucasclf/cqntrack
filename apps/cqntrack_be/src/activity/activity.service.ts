import type { ActivityItem, ListActivityQuery } from "@cqntrack/shared";
import { and, desc, eq, lt } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity } from "../db/schema";

type Db = ReturnType<typeof createDb>;
type ActivityRow = typeof activity.$inferSelect;

// Genérico entre seções — a linha já vem com o snapshot pronto (ver
// toActivitySnapshot em games.service.ts), sem precisar de join.
function toActivityItem(row: ActivityRow): ActivityItem {
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
  };
}

export async function listActivity(
  db: Db,
  userId: string,
  query: ListActivityQuery,
): Promise<{ items: ActivityItem[]; nextCursor: string | null }> {
  const conditions = [eq(activity.userId, userId)];
  if (query.before) {
    conditions.push(lt(activity.createdAt, new Date(query.before)));
  }
  if (query.mediaType) {
    conditions.push(eq(activity.mediaType, query.mediaType));
  }

  // Busca um item a mais só pra saber se existe próxima página.
  const rows = await db.query.activity.findMany({
    where: and(...conditions),
    orderBy: desc(activity.createdAt),
    limit: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page.at(-1);

  return {
    items: page.map(toActivityItem),
    nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
  };
}

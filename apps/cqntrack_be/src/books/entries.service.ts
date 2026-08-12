import type {
  BookEntry,
  BookEntryWithBook,
  ListBookEntriesQuery,
  UpsertBookEntryRequest,
} from "@cqntrack/shared";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, bookEntry } from "../db/schema";
import { withoutUndefined } from "../lib/without-undefined";
import { type CachedBook, getOrCacheBook, mapCachedBookToSummary, toActivitySnapshot } from "./books.service";

type Db = ReturnType<typeof createDb>;
type BookEntryRow = typeof bookEntry.$inferSelect;

const SORT_COLUMNS = {
  status: bookEntry.status,
  rating: bookEntry.rating,
  favorite: bookEntry.favoritedAt,
  updatedAt: bookEntry.updatedAt,
} as const;

function toBookEntry(row: BookEntryRow): BookEntry {
  return {
    id: row.id,
    status: row.status,
    rating: row.rating,
    favoritedAt: row.favoritedAt?.toISOString() ?? null,
    review: row.review,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function logBookEntryActivities(
  db: Db,
  userId: string,
  cachedBook: CachedBook,
  input: UpsertBookEntryRequest,
): Promise<void> {
  const snapshot = toActivitySnapshot(cachedBook);
  const activities: (typeof activity.$inferInsert)[] = [];

  // Só loga quando um status real é definido — desmarcar (status: null),
  // como desfavoritar, não vira atividade no feed. Mesmo tipo de jogo
  // ("status_changed") — livro também é status-based.
  if (input.status !== undefined && input.status !== null) {
    activities.push({ userId, ...snapshot, type: "status_changed", metadata: { status: input.status } });
  }
  if (input.rating !== undefined && input.rating !== null) {
    activities.push({ userId, ...snapshot, type: "rated", metadata: { rating: input.rating } });
  }
  if (input.review !== undefined && input.review !== null && input.review.trim() !== "") {
    activities.push({ userId, ...snapshot, type: "reviewed" });
  }
  // Só ao favoritar — desfavoritar não vira atividade (mesmo espírito de
  // desmarcar status).
  if (input.favorited === true) {
    activities.push({ userId, ...snapshot, type: "favorited" });
  }

  if (activities.length > 0) {
    await db.insert(activity).values(activities);
  }
}

export async function getBookEntryForUser(
  db: Db,
  userId: string,
  googleBooksId: string,
): Promise<BookEntry | null> {
  const row = await db.query.bookEntry.findFirst({
    where: and(eq(bookEntry.userId, userId), eq(bookEntry.bookId, googleBooksId)),
  });
  return row ? toBookEntry(row) : null;
}

export async function upsertBookEntry(
  env: Env,
  db: Db,
  userId: string,
  googleBooksId: string,
  input: UpsertBookEntryRequest,
): Promise<BookEntry> {
  const cachedBook = await getOrCacheBook(env, db, googleBooksId); // garante que a FK bookId existe

  const existing = await db.query.bookEntry.findFirst({
    where: and(eq(bookEntry.userId, userId), eq(bookEntry.bookId, googleBooksId)),
  });

  const patch = withoutUndefined({
    status: input.status,
    rating: input.rating,
    review: input.review,
    favoritedAt: input.favorited === undefined ? undefined : input.favorited ? new Date() : null,
  });

  const [row] = existing
    ? await db.update(bookEntry).set(patch).where(eq(bookEntry.id, existing.id)).returning()
    : await db.insert(bookEntry).values({ userId, bookId: googleBooksId, ...patch }).returning();

  if (!row) {
    throw new Error("Falha ao gravar a marcação do livro");
  }

  await logBookEntryActivities(db, userId, cachedBook, input);

  return toBookEntry(row);
}

// Sem limite de quantidade — todo livro com favoritedAt preenchido, mais
// recente primeiro.
export async function getFavorites(db: Db, userId: string): Promise<BookEntryWithBook[]> {
  const rows = await db.query.bookEntry.findMany({
    where: and(eq(bookEntry.userId, userId), isNotNull(bookEntry.favoritedAt)),
    orderBy: desc(bookEntry.favoritedAt),
    with: { book: true },
  });

  return rows.map((row) => ({ ...toBookEntry(row), book: mapCachedBookToSummary(row.book) }));
}

export async function deleteBookEntry(db: Db, userId: string, googleBooksId: string): Promise<void> {
  await db.delete(bookEntry).where(and(eq(bookEntry.userId, userId), eq(bookEntry.bookId, googleBooksId)));
}

export async function listBookEntries(
  db: Db,
  userId: string,
  query: ListBookEntriesQuery,
): Promise<{ items: BookEntryWithBook[]; total: number }> {
  const conditions = [eq(bookEntry.userId, userId)];
  if (query.status) {
    conditions.push(eq(bookEntry.status, query.status));
  }
  if (query.favorite !== undefined) {
    conditions.push(query.favorite ? isNotNull(bookEntry.favoritedAt) : isNull(bookEntry.favoritedAt));
  }
  const where = and(...conditions);

  const sortColumn = SORT_COLUMNS[query.sortBy];
  const orderBy = query.order === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [rows, countResult] = await Promise.all([
    db.query.bookEntry.findMany({
      where,
      orderBy,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      with: { book: true },
    }),
    db.select({ count: sql<number>`count(*)` }).from(bookEntry).where(where),
  ]);

  return {
    items: rows.map((row) => ({
      ...toBookEntry(row),
      book: mapCachedBookToSummary(row.book),
    })),
    total: countResult[0]?.count ?? 0,
  };
}

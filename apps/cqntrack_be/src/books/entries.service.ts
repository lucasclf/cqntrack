import {
  FAVORITE_SLOTS,
  type BookEntry,
  type BookEntryWithBook,
  type BookFavoriteSlot,
  type FavoriteSlotNumber,
  type ListBookEntriesQuery,
  type UpsertBookEntryRequest,
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
  favorite: bookEntry.favoriteSlot,
  updatedAt: bookEntry.updatedAt,
} as const;

function toBookEntry(row: BookEntryRow): BookEntry {
  return {
    id: row.id,
    status: row.status,
    rating: row.rating,
    favoriteSlot: row.favoriteSlot as BookEntry["favoriteSlot"],
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

// Define qual livro ocupa um dos 4 slots fixos de favorito do usuário — a
// única forma de favoritar (não existe um "favorite: true" solto em
// qualquer marcação). Sempre sobrescreve: libera quem estava nesse slot e
// qualquer outro slot que esse mesmo livro já ocupasse, já que um livro só
// fica em um slot por vez.
export async function setFavoriteSlot(
  env: Env,
  db: Db,
  userId: string,
  slot: FavoriteSlotNumber,
  googleBooksId: string,
): Promise<BookEntry> {
  const cachedBook = await getOrCacheBook(env, db, googleBooksId);

  await db
    .update(bookEntry)
    .set({ favoriteSlot: null })
    .where(and(eq(bookEntry.userId, userId), eq(bookEntry.favoriteSlot, slot)));
  await db
    .update(bookEntry)
    .set({ favoriteSlot: null })
    .where(and(eq(bookEntry.userId, userId), eq(bookEntry.bookId, googleBooksId)));

  const existing = await db.query.bookEntry.findFirst({
    where: and(eq(bookEntry.userId, userId), eq(bookEntry.bookId, googleBooksId)),
  });

  const [row] = existing
    ? await db.update(bookEntry).set({ favoriteSlot: slot }).where(eq(bookEntry.id, existing.id)).returning()
    : await db.insert(bookEntry).values({ userId, bookId: googleBooksId, favoriteSlot: slot }).returning();

  if (!row) {
    throw new Error("Falha ao definir o favorito");
  }

  await db.insert(activity).values({ userId, ...toActivitySnapshot(cachedBook), type: "favorited" });

  return toBookEntry(row);
}

// Sempre os 4 slots, preenchidos ou não — quem chama decide o que fazer com
// os vazios (ex.: mostrar um placeholder "+" só na própria home).
export async function getFavoriteSlots(db: Db, userId: string): Promise<BookFavoriteSlot[]> {
  const rows = await db.query.bookEntry.findMany({
    where: and(eq(bookEntry.userId, userId), isNotNull(bookEntry.favoriteSlot)),
    with: { book: true },
  });
  const bySlot = new Map(rows.map((row) => [row.favoriteSlot, row]));

  return FAVORITE_SLOTS.map((slot) => {
    const row = bySlot.get(slot);
    return {
      slot,
      entry: row ? { ...toBookEntry(row), book: mapCachedBookToSummary(row.book) } : null,
    };
  });
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
    conditions.push(
      query.favorite ? isNotNull(bookEntry.favoriteSlot) : isNull(bookEntry.favoriteSlot),
    );
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

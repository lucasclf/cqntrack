import type {
  BookList,
  BookListDetail,
  CreateBookListRequest,
  UpdateBookListRequest,
} from "@cqntrack/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, bookList, bookListItem } from "../db/schema";
import { isUniqueConstraintError } from "../lib/is-unique-constraint-error";
import { withoutUndefined } from "../lib/without-undefined";
import { getOrCacheBook, mapCachedBookToSummary, toActivitySnapshot } from "./books.service";

type Db = ReturnType<typeof createDb>;
type BookListRow = typeof bookList.$inferSelect;

export class BookListNotFoundError extends Error {
  constructor(public readonly listId: string) {
    super(`Lista ${listId} não encontrada`);
    this.name = "BookListNotFoundError";
  }
}

export class DuplicateBookListNameError extends Error {
  constructor(public readonly name: string) {
    super(`Já existe uma lista chamada "${name}"`);
    this.name = "DuplicateBookListNameError";
  }
}

async function withItemCount(db: Db, rows: BookListRow[]): Promise<BookList[]> {
  if (rows.length === 0) {
    return [];
  }

  const counts = await db
    .select({ listId: bookListItem.listId, count: sql<number>`count(*)` })
    .from(bookListItem)
    .where(
      inArray(
        bookListItem.listId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(bookListItem.listId);
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
async function getOwnedBookList(db: Db, userId: string, listId: string): Promise<BookListRow> {
  const [row] = await db
    .select()
    .from(bookList)
    .where(and(eq(bookList.id, listId), eq(bookList.userId, userId)));
  if (!row) {
    throw new BookListNotFoundError(listId);
  }
  return row;
}

export async function listBookLists(db: Db, userId: string): Promise<BookList[]> {
  const rows = await db
    .select()
    .from(bookList)
    .where(eq(bookList.userId, userId))
    .orderBy(desc(bookList.updatedAt));
  return withItemCount(db, rows);
}

export async function createBookList(
  db: Db,
  userId: string,
  input: CreateBookListRequest,
): Promise<BookList> {
  try {
    const [row] = await db
      .insert(bookList)
      .values({ userId, name: input.name, description: input.description ?? null })
      .returning();
    if (!row) {
      throw new Error("Falha ao criar lista");
    }
    const [list] = await withItemCount(db, [row]);
    return list!;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateBookListNameError(input.name);
    }
    throw error;
  }
}

export async function updateBookList(
  db: Db,
  userId: string,
  listId: string,
  input: UpdateBookListRequest,
): Promise<BookList> {
  await getOwnedBookList(db, userId, listId);

  const patch = withoutUndefined({ name: input.name, description: input.description });

  try {
    const [row] =
      Object.keys(patch).length > 0
        ? await db.update(bookList).set(patch).where(eq(bookList.id, listId)).returning()
        : await db.select().from(bookList).where(eq(bookList.id, listId));
    if (!row) {
      throw new Error("Falha ao atualizar lista");
    }
    const [list] = await withItemCount(db, [row]);
    return list!;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateBookListNameError(input.name ?? "");
    }
    throw error;
  }
}

export async function deleteBookList(db: Db, userId: string, listId: string): Promise<void> {
  await getOwnedBookList(db, userId, listId);
  await db.delete(bookList).where(eq(bookList.id, listId));
}

export async function getBookListDetail(
  db: Db,
  userId: string,
  listId: string,
): Promise<BookListDetail> {
  const row = await getOwnedBookList(db, userId, listId);

  const items = await db.query.bookListItem.findMany({
    where: eq(bookListItem.listId, listId),
    orderBy: desc(bookListItem.addedAt),
    with: { book: true },
  });

  const [list] = await withItemCount(db, [row]);
  return {
    ...list!,
    items: items.map((item) => mapCachedBookToSummary(item.book)),
  };
}

export async function addBookToList(
  env: Env,
  db: Db,
  userId: string,
  listId: string,
  googleBooksId: string,
): Promise<void> {
  const list = await getOwnedBookList(db, userId, listId);
  const cachedBook = await getOrCacheBook(env, db, googleBooksId); // garante a FK bookId

  const inserted = await db
    .insert(bookListItem)
    .values({ listId, bookId: googleBooksId })
    .onConflictDoNothing()
    .returning();

  // Só loga atividade se o livro realmente entrou agora (evita duplicar o
  // registro quando ele já estava na lista).
  if (inserted.length > 0) {
    await db.insert(activity).values({
      userId,
      ...toActivitySnapshot(cachedBook),
      type: "added_to_list",
      metadata: { listId, listName: list.name },
    });
  }
}

export async function removeBookFromList(
  db: Db,
  userId: string,
  listId: string,
  googleBooksId: string,
): Promise<void> {
  await getOwnedBookList(db, userId, listId);
  await db
    .delete(bookListItem)
    .where(and(eq(bookListItem.listId, listId), eq(bookListItem.bookId, googleBooksId)));
}

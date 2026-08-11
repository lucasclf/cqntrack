import { BOOK_STATUSES } from "@cqntrack/shared";
import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

// Cache GLOBAL de livros (compartilhado entre todos os usuários) — sem FK
// pra user, nunca é afetado por exclusão de conta. `googleBooksId` é string
// (diferente de igdbId/tmdbId, que são inteiros). `rating` aqui é a nota
// agregada da própria Google Books (0-5, averageRating) — não confundir com
// a nota pessoal do usuário (0-5, campo `rating` de bookEntry): mesma
// escala, fontes diferentes. `publishedDate` fica como texto cru (a Google
// Books devolve datas parciais tipo "2020" ou "2020-05", que não convertem
// bem pra timestamp sem perder ou inventar precisão).
export const book = sqliteTable("book", {
  googleBooksId: text("google_books_id").primaryKey(),
  title: text("title").notNull(),
  authors: text("authors", { mode: "json" }).$type<string[]>(),
  coverUrl: text("cover_url"),
  publishedDate: text("published_date"),
  description: text("description"),
  categories: text("categories", { mode: "json" }).$type<string[]>(),
  pageCount: integer("page_count"),
  rating: real("rating"),
  cachedAt: integer("cached_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

// Marcação do usuário para um livro: status, nota pessoal, favorito e
// review. Sem `platforms` (sem equivalente em livro) — estruturalmente é
// gameEntry menos esse campo. Um usuário só pode ter uma marcação por livro
// (upsert).
export const bookEntry = sqliteTable(
  "book_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => book.googleBooksId, { onDelete: "cascade" }),
    // Opcional: null = livro sem status marcado (usuário pode desmarcar).
    status: text("status", { enum: BOOK_STATUSES }),
    rating: real("rating"),
    // 1-4, null = não é favorito. Favoritar só acontece pelos 4 slots fixos
    // da home (PUT /api/books/favorites/:slot), mesmo padrão de gameEntry.
    favoriteSlot: integer("favorite_slot"),
    review: text("review"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("book_entry_user_book_unique").on(table.userId, table.bookId),
    index("book_entry_user_status_idx").on(table.userId, table.status),
    // Parcial: só entra no índice quem tem um slot — garante no banco que um
    // usuário nunca tem dois livros no mesmo slot (1-4) ao mesmo tempo.
    uniqueIndex("book_entry_user_favorite_slot_unique")
      .on(table.userId, table.favoriteSlot)
      .where(sql`${table.favoriteSlot} is not null`),
  ],
);

export const bookList = sqliteTable(
  "book_list",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("book_list_user_idx").on(table.userId),
    uniqueIndex("book_list_user_name_unique").on(table.userId, table.name),
  ],
);

export const bookListItem = sqliteTable(
  "book_list_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    listId: text("list_id")
      .notNull()
      .references(() => bookList.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => book.googleBooksId, { onDelete: "cascade" }),
    addedAt: integer("added_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [uniqueIndex("book_list_item_list_book_unique").on(table.listId, table.bookId)],
);

export const bookRelations = relations(book, ({ many }) => ({
  entries: many(bookEntry),
  listItems: many(bookListItem),
}));

export const bookEntryRelations = relations(bookEntry, ({ one }) => ({
  user: one(user, { fields: [bookEntry.userId], references: [user.id] }),
  book: one(book, { fields: [bookEntry.bookId], references: [book.googleBooksId] }),
}));

export const bookListRelations = relations(bookList, ({ one, many }) => ({
  user: one(user, { fields: [bookList.userId], references: [user.id] }),
  items: many(bookListItem),
}));

export const bookListItemRelations = relations(bookListItem, ({ one }) => ({
  list: one(bookList, { fields: [bookListItem.listId], references: [bookList.id] }),
  book: one(book, { fields: [bookListItem.bookId], references: [book.googleBooksId] }),
}));

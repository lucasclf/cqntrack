import { MANGA_PUBLICATION_STATUSES, MANGA_STATUSES } from "@cqntrack/shared";
import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

// Cache GLOBAL de mangás (compartilhado entre todos os usuários) — sem FK
// pra user, nunca é afetado por exclusão de conta. `mangadexId` é string
// (a MangaDex usa UUID, diferente de igdbId/tmdbId, que são inteiros).
// `authors`/`tags` vêm de graça no mesmo GET /manga/:id que já cacheia o
// mangá (author+artist deduplicados, tags filtradas a genre/theme) — sem
// request extra, diferente de `cast` em filme/série (que exige uma 2ª
// chamada de créditos). `publicationStatus` é o ciclo de vida da OBRA
// segundo a própria MangaDex (ongoing/completed/hiatus/cancelled) — não
// confundir com o status de LEITURA do usuário, que vive em `mangaEntry`.
// Sem contagem de volume/capítulo aqui de propósito: exigiria uma chamada
// separada a /aggregate por item, cara demais pra tela de busca com vários
// resultados — ver mangaChapterRead/getMangaVolumes (buscado ao vivo, sem
// cache, só na tela de detalhe, mesmo padrão da lista de episódios em
// série).
export const manga = sqliteTable("manga", {
  mangadexId: text("mangadex_id").primaryKey(),
  title: text("title").notNull(),
  coverUrl: text("cover_url"),
  description: text("description"),
  authors: text("authors", { mode: "json" }).$type<{ id: string; name: string }[]>(),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  publicationStatus: text("publication_status", { enum: MANGA_PUBLICATION_STATUSES }),
  contentRating: text("content_rating"),
  year: integer("year"),
  cachedAt: integer("cached_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

// Marcação do usuário para um mangá: status de leitura, nota pessoal,
// favorito e review. Estruturalmente igual a bookEntry — mangá também é
// "leitura" (want_to_read/reading/read/dropped), mesmo tendo substrutura de
// capítulo (ver mangaChapterRead abaixo), que série não tem em forma de
// status. Um usuário só pode ter uma marcação por mangá (upsert).
export const mangaEntry = sqliteTable(
  "manga_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mangaId: text("manga_id")
      .notNull()
      .references(() => manga.mangadexId, { onDelete: "cascade" }),
    status: text("status", { enum: MANGA_STATUSES }),
    rating: real("rating"),
    favoritedAt: integer("favorited_at", { mode: "timestamp_ms" }),
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
    uniqueIndex("manga_entry_user_manga_unique").on(table.userId, table.mangaId),
    index("manga_entry_user_status_idx").on(table.userId, table.status),
  ],
);

// Uma linha por capítulo lido — existência = lido, sem coluna boolean,
// mesmo padrão de series_episode_watch. `chapterNumber` é REAL (não
// integer): a MangaDex aceita capítulo decimal (ex. "10.5", extra/bônus
// fora da numeração principal). `volumeNumber` usa o sentinela `0` pra
// "sem volume" (a MangaDex agrupa capítulo avulso sob a chave "none") em
// vez de `null` — o SQLite trata cada `NULL` como distinto num índice
// único, então duas linhas com volumeNumber null e o mesmo chapterNumber
// não colidiriam no unique index abaixo, quebrando a garantia de "1 linha
// por capítulo". Sem cache de nome/data do capítulo (isso vem ao vivo da
// MangaDex a cada abertura de volume, ver getMangaVolumes) — só o "lido"
// fica salvo aqui.
export const mangaChapterRead = sqliteTable(
  "manga_chapter_read",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mangaId: text("manga_id")
      .notNull()
      .references(() => manga.mangadexId, { onDelete: "cascade" }),
    volumeNumber: integer("volume_number").notNull(),
    chapterNumber: real("chapter_number").notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("manga_chapter_read_user_manga_chapter_unique").on(
      table.userId,
      table.mangaId,
      table.volumeNumber,
      table.chapterNumber,
    ),
    index("manga_chapter_read_user_manga_idx").on(table.userId, table.mangaId),
  ],
);

export const mangaList = sqliteTable(
  "manga_list",
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
    index("manga_list_user_idx").on(table.userId),
    uniqueIndex("manga_list_user_name_unique").on(table.userId, table.name),
  ],
);

export const mangaListItem = sqliteTable(
  "manga_list_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    listId: text("list_id")
      .notNull()
      .references(() => mangaList.id, { onDelete: "cascade" }),
    mangaId: text("manga_id")
      .notNull()
      .references(() => manga.mangadexId, { onDelete: "cascade" }),
    addedAt: integer("added_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [uniqueIndex("manga_list_item_list_manga_unique").on(table.listId, table.mangaId)],
);

export const mangaRelations = relations(manga, ({ many }) => ({
  entries: many(mangaEntry),
  chapterReads: many(mangaChapterRead),
  listItems: many(mangaListItem),
}));

export const mangaEntryRelations = relations(mangaEntry, ({ one }) => ({
  user: one(user, { fields: [mangaEntry.userId], references: [user.id] }),
  manga: one(manga, { fields: [mangaEntry.mangaId], references: [manga.mangadexId] }),
}));

export const mangaChapterReadRelations = relations(mangaChapterRead, ({ one }) => ({
  user: one(user, { fields: [mangaChapterRead.userId], references: [user.id] }),
  manga: one(manga, { fields: [mangaChapterRead.mangaId], references: [manga.mangadexId] }),
}));

export const mangaListRelations = relations(mangaList, ({ one, many }) => ({
  user: one(user, { fields: [mangaList.userId], references: [user.id] }),
  items: many(mangaListItem),
}));

export const mangaListItemRelations = relations(mangaListItem, ({ one }) => ({
  list: one(mangaList, { fields: [mangaListItem.listId], references: [mangaList.id] }),
  manga: one(manga, { fields: [mangaListItem.mangaId], references: [manga.mangadexId] }),
}));

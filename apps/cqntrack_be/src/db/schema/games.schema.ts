import { GAME_STATUSES } from "@cqntrack/shared";
import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

// Cache GLOBAL de jogos (compartilhado entre todos os usuários) — sem FK pra
// user, nunca é afetado por exclusão de conta. `rating` aqui é a nota agregada
// da própria IGDB (0-100) — não confundir com a nota pessoal do usuário
// (0-5, campo `rating` de gameEntry).
export const game = sqliteTable("game", {
  igdbId: integer("igdb_id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  coverImageId: text("cover_image_id"),
  firstReleaseDate: integer("first_release_date", { mode: "timestamp" }),
  summary: text("summary"),
  genres: text("genres", { mode: "json" }).$type<string[]>(),
  platforms: text("platforms", { mode: "json" }).$type<string[]>(),
  rating: real("rating"),
  cachedAt: integer("cached_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

// Marcação do usuário para um jogo: status, nota pessoal, favorito, plataforma
// jogada e review. Um usuário só pode ter uma marcação por jogo (upsert).
export const gameEntry = sqliteTable(
  "game_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => game.igdbId, { onDelete: "cascade" }),
    // Opcional: null = jogo sem status marcado (usuário pode desmarcar).
    status: text("status", { enum: GAME_STATUSES }),
    rating: real("rating"),
    // 1-4, null = não é favorito. Favoritar só acontece pelos 4 slots fixos
    // da home (PUT /api/games/favorites/:slot) — não é mais um boolean solto
    // editável em qualquer marcação.
    favoriteSlot: integer("favorite_slot"),
    // Lista — um jogo pode ter sido jogado em mais de uma plataforma.
    platforms: text("platforms", { mode: "json" }).$type<string[]>(),
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
    uniqueIndex("game_entry_user_game_unique").on(table.userId, table.gameId),
    index("game_entry_user_status_idx").on(table.userId, table.status),
    // Parcial: só entra no índice quem tem um slot — garante no banco que um
    // usuário nunca tem dois jogos no mesmo slot (1-4) ao mesmo tempo.
    uniqueIndex("game_entry_user_favorite_slot_unique")
      .on(table.userId, table.favoriteSlot)
      .where(sql`${table.favoriteSlot} is not null`),
  ],
);

export const gameList = sqliteTable(
  "game_list",
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
    index("game_list_user_idx").on(table.userId),
    uniqueIndex("game_list_user_name_unique").on(table.userId, table.name),
  ],
);

export const gameListItem = sqliteTable(
  "game_list_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    listId: text("list_id")
      .notNull()
      .references(() => gameList.id, { onDelete: "cascade" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => game.igdbId, { onDelete: "cascade" }),
    addedAt: integer("added_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [uniqueIndex("game_list_item_list_game_unique").on(table.listId, table.gameId)],
);

export const gameRelations = relations(game, ({ many }) => ({
  entries: many(gameEntry),
  listItems: many(gameListItem),
}));

export const gameEntryRelations = relations(gameEntry, ({ one }) => ({
  user: one(user, { fields: [gameEntry.userId], references: [user.id] }),
  game: one(game, { fields: [gameEntry.gameId], references: [game.igdbId] }),
}));

export const gameListRelations = relations(gameList, ({ one, many }) => ({
  user: one(user, { fields: [gameList.userId], references: [user.id] }),
  items: many(gameListItem),
}));

export const gameListItemRelations = relations(gameListItem, ({ one }) => ({
  list: one(gameList, { fields: [gameListItem.listId], references: [gameList.id] }),
  game: one(game, { fields: [gameListItem.gameId], references: [game.igdbId] }),
}));

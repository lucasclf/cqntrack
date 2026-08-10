import { SERIES_STATUSES } from "@cqntrack/shared";
import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

// Cache GLOBAL de séries (compartilhado entre todos os usuários) — sem FK
// pra user, nunca é afetado por exclusão de conta. `rating` aqui é a nota
// agregada da própria TMDB (0-10) — não confundir com a nota pessoal do
// usuário (0-5, campo `rating` de seriesEntry). numberOfSeasons/
// numberOfEpisodes só vêm preenchidos depois que a série é cacheada via
// detalhe (a busca da TMDB não traz esse dado).
export const series = sqliteTable("series", {
  tmdbId: integer("tmdb_id").primaryKey(),
  name: text("name").notNull(),
  posterPath: text("poster_path"),
  firstAirDate: integer("first_air_date", { mode: "timestamp" }),
  overview: text("overview"),
  genres: text("genres", { mode: "json" }).$type<string[]>(),
  numberOfSeasons: integer("number_of_seasons"),
  numberOfEpisodes: integer("number_of_episodes"),
  rating: real("rating"),
  cachedAt: integer("cached_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

// Marcação do usuário para uma série: status, nota pessoal, progresso
// (temporada/episódio atual), favorito e review. Um usuário só pode ter uma
// marcação por série (upsert). Sem campo de "plataforma" — não existe
// equivalente pra série (diferente de gameEntry).
export const seriesEntry = sqliteTable(
  "series_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    seriesId: integer("series_id")
      .notNull()
      .references(() => series.tmdbId, { onDelete: "cascade" }),
    // Opcional: null = série sem status marcado (usuário pode desmarcar).
    status: text("status", { enum: SERIES_STATUSES }),
    rating: real("rating"),
    currentSeason: integer("current_season"),
    currentEpisode: integer("current_episode"),
    // 1-4, null = não é favorito. Favoritar só acontece pelos 4 slots fixos
    // da home (PUT /api/series/favorites/:slot), mesmo padrão de gameEntry.
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
    uniqueIndex("series_entry_user_series_unique").on(table.userId, table.seriesId),
    index("series_entry_user_status_idx").on(table.userId, table.status),
    // Parcial: só entra no índice quem tem um slot — garante no banco que um
    // usuário nunca tem duas séries no mesmo slot (1-4) ao mesmo tempo.
    uniqueIndex("series_entry_user_favorite_slot_unique")
      .on(table.userId, table.favoriteSlot)
      .where(sql`${table.favoriteSlot} is not null`),
  ],
);

export const seriesList = sqliteTable(
  "series_list",
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
    index("series_list_user_idx").on(table.userId),
    uniqueIndex("series_list_user_name_unique").on(table.userId, table.name),
  ],
);

export const seriesListItem = sqliteTable(
  "series_list_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    listId: text("list_id")
      .notNull()
      .references(() => seriesList.id, { onDelete: "cascade" }),
    seriesId: integer("series_id")
      .notNull()
      .references(() => series.tmdbId, { onDelete: "cascade" }),
    addedAt: integer("added_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [uniqueIndex("series_list_item_list_series_unique").on(table.listId, table.seriesId)],
);

export const seriesRelations = relations(series, ({ many }) => ({
  entries: many(seriesEntry),
  listItems: many(seriesListItem),
}));

export const seriesEntryRelations = relations(seriesEntry, ({ one }) => ({
  user: one(user, { fields: [seriesEntry.userId], references: [user.id] }),
  series: one(series, { fields: [seriesEntry.seriesId], references: [series.tmdbId] }),
}));

export const seriesListRelations = relations(seriesList, ({ one, many }) => ({
  user: one(user, { fields: [seriesList.userId], references: [user.id] }),
  items: many(seriesListItem),
}));

export const seriesListItemRelations = relations(seriesListItem, ({ one }) => ({
  list: one(seriesList, { fields: [seriesListItem.listId], references: [seriesList.id] }),
  series: one(series, { fields: [seriesListItem.seriesId], references: [series.tmdbId] }),
}));

import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

// Cache GLOBAL de séries (compartilhado entre todos os usuários) — sem FK
// pra user, nunca é afetado por exclusão de conta. `rating` aqui é a nota
// agregada da própria TMDB (0-10) — não confundir com a nota pessoal do
// usuário (0-5, campo `rating` de seriesEntry). numberOfSeasons/
// numberOfEpisodes/seasons só vêm preenchidos depois que a série é
// cacheada via detalhe (a busca da TMDB não traz esse dado). `seasons` é
// só o resumo (nome/contagem de episódios) — a lista de episódios em si
// nunca é cacheada, é buscada ao vivo (ver series_episode_watch abaixo).
export const series = sqliteTable("series", {
  tmdbId: integer("tmdb_id").primaryKey(),
  name: text("name").notNull(),
  posterPath: text("poster_path"),
  firstAirDate: integer("first_air_date", { mode: "timestamp" }),
  overview: text("overview"),
  genres: text("genres", { mode: "json" }).$type<string[]>(),
  numberOfSeasons: integer("number_of_seasons"),
  numberOfEpisodes: integer("number_of_episodes"),
  seasons: text("seasons", { mode: "json" }).$type<
    {
      seasonNumber: number;
      name: string;
      episodeCount: number;
      airDate: string | null;
      posterPath: string | null;
    }[]
  >(),
  rating: real("rating"),
  cachedAt: integer("cached_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

// Marcação do usuário para uma série: nota pessoal, favorito e review. Sem
// status e sem ponteiro de progresso — o progresso de verdade mora em
// series_episode_watch (uma linha por episódio assistido). Um usuário só
// pode ter uma marcação por série (upsert).
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
    rating: real("rating"),
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
    // Parcial: só entra no índice quem tem um slot — garante no banco que um
    // usuário nunca tem duas séries no mesmo slot (1-4) ao mesmo tempo.
    uniqueIndex("series_entry_user_favorite_slot_unique")
      .on(table.userId, table.favoriteSlot)
      .where(sql`${table.favoriteSlot} is not null`),
  ],
);

// Uma linha por episódio assistido — existência = assistido, sem coluna
// boolean. Sem cache de nome/data/still do episódio (isso vem ao vivo da
// TMDB a cada abertura de temporada); só o que é nosso (o "assistido")
// fica salvo aqui. Sem FK composta pra um cache de episódio (não existe) —
// a UI só deixa marcar depois que a temporada já carregou da TMDB.
export const seriesEpisodeWatch = sqliteTable(
  "series_episode_watch",
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
    seasonNumber: integer("season_number").notNull(),
    episodeNumber: integer("episode_number").notNull(),
    watchedAt: integer("watched_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("series_episode_watch_user_series_episode_unique").on(
      table.userId,
      table.seriesId,
      table.seasonNumber,
      table.episodeNumber,
    ),
    index("series_episode_watch_user_series_idx").on(table.userId, table.seriesId),
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
  episodeWatches: many(seriesEpisodeWatch),
}));

export const seriesEntryRelations = relations(seriesEntry, ({ one }) => ({
  user: one(user, { fields: [seriesEntry.userId], references: [user.id] }),
  series: one(series, { fields: [seriesEntry.seriesId], references: [series.tmdbId] }),
}));

export const seriesEpisodeWatchRelations = relations(seriesEpisodeWatch, ({ one }) => ({
  user: one(user, { fields: [seriesEpisodeWatch.userId], references: [user.id] }),
  series: one(series, { fields: [seriesEpisodeWatch.seriesId], references: [series.tmdbId] }),
}));

export const seriesListRelations = relations(seriesList, ({ one, many }) => ({
  user: one(user, { fields: [seriesList.userId], references: [user.id] }),
  items: many(seriesListItem),
}));

export const seriesListItemRelations = relations(seriesListItem, ({ one }) => ({
  list: one(seriesList, { fields: [seriesListItem.listId], references: [seriesList.id] }),
  series: one(series, { fields: [seriesListItem.seriesId], references: [series.tmdbId] }),
}));

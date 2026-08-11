import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

// Cache GLOBAL de filmes (compartilhado entre todos os usuários) — sem FK
// pra user, nunca é afetado por exclusão de conta. `rating` aqui é a nota
// agregada da própria TMDB (0-10) — não confundir com a nota pessoal do
// usuário (0-5, campo `rating` de movieEntry). `runtime` (minutos) só vem
// preenchido depois que o filme é cacheado via detalhe (a busca da TMDB não
// traz esse dado). Filme não tem substrutura (sem equivalente a "seasons").
export const movie = sqliteTable("movie", {
  tmdbId: integer("tmdb_id").primaryKey(),
  name: text("name").notNull(),
  posterPath: text("poster_path"),
  releaseDate: integer("release_date", { mode: "timestamp" }),
  overview: text("overview"),
  genres: text("genres", { mode: "json" }).$type<string[]>(),
  runtime: integer("runtime"),
  rating: real("rating"),
  cachedAt: integer("cached_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

// Marcação do usuário para um filme: nota pessoal, favorito, review e
// "assistido" (watchedAt — null = não assistido, existência = assistido,
// sem coluna boolean redundante). Sem status: filme não tem substrutura
// (diferente de série), então não há progresso pra rastrear além disso. Um
// usuário só pode ter uma marcação por filme (upsert).
export const movieEntry = sqliteTable(
  "movie_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movie.tmdbId, { onDelete: "cascade" }),
    rating: real("rating"),
    watchedAt: integer("watched_at", { mode: "timestamp_ms" }),
    // 1-4, null = não é favorito. Favoritar só acontece pelos 4 slots fixos
    // da home (PUT /api/movies/favorites/:slot), mesmo padrão de gameEntry.
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
    uniqueIndex("movie_entry_user_movie_unique").on(table.userId, table.movieId),
    // Parcial: só entra no índice quem tem um slot — garante no banco que um
    // usuário nunca tem dois filmes no mesmo slot (1-4) ao mesmo tempo.
    uniqueIndex("movie_entry_user_favorite_slot_unique")
      .on(table.userId, table.favoriteSlot)
      .where(sql`${table.favoriteSlot} is not null`),
  ],
);

export const movieList = sqliteTable(
  "movie_list",
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
    index("movie_list_user_idx").on(table.userId),
    uniqueIndex("movie_list_user_name_unique").on(table.userId, table.name),
  ],
);

export const movieListItem = sqliteTable(
  "movie_list_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    listId: text("list_id")
      .notNull()
      .references(() => movieList.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movie.tmdbId, { onDelete: "cascade" }),
    addedAt: integer("added_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [uniqueIndex("movie_list_item_list_movie_unique").on(table.listId, table.movieId)],
);

export const movieRelations = relations(movie, ({ many }) => ({
  entries: many(movieEntry),
  listItems: many(movieListItem),
}));

export const movieEntryRelations = relations(movieEntry, ({ one }) => ({
  user: one(user, { fields: [movieEntry.userId], references: [user.id] }),
  movie: one(movie, { fields: [movieEntry.movieId], references: [movie.tmdbId] }),
}));

export const movieListRelations = relations(movieList, ({ one, many }) => ({
  user: one(user, { fields: [movieList.userId], references: [user.id] }),
  items: many(movieListItem),
}));

export const movieListItemRelations = relations(movieListItem, ({ one }) => ({
  list: one(movieList, { fields: [movieListItem.listId], references: [movieList.id] }),
  movie: one(movie, { fields: [movieListItem.movieId], references: [movie.tmdbId] }),
}));

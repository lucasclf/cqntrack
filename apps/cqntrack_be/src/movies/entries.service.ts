import {
  FAVORITE_SLOTS,
  type FavoriteSlotNumber,
  type ListMovieEntriesQuery,
  type MovieEntry,
  type MovieEntryWithMovie,
  type MovieFavoriteSlot,
  type UpsertMovieEntryRequest,
} from "@cqntrack/shared";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, movieEntry } from "../db/schema";
import { withoutUndefined } from "../lib/without-undefined";
import { type CachedMovie, getOrCacheMovie, mapCachedMovieToSummary, toActivitySnapshot } from "./movies.service";

type Db = ReturnType<typeof createDb>;
type MovieEntryRow = typeof movieEntry.$inferSelect;

const SORT_COLUMNS = {
  rating: movieEntry.rating,
  favorite: movieEntry.favoriteSlot,
  updatedAt: movieEntry.updatedAt,
} as const;

function toMovieEntry(row: MovieEntryRow): MovieEntry {
  return {
    id: row.id,
    rating: row.rating,
    watchedAt: row.watchedAt ? row.watchedAt.toISOString() : null,
    favoriteSlot: row.favoriteSlot as MovieEntry["favoriteSlot"],
    review: row.review,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function logMovieEntryActivities(
  db: Db,
  userId: string,
  cachedMovie: CachedMovie,
  input: UpsertMovieEntryRequest,
): Promise<void> {
  const snapshot = toActivitySnapshot(cachedMovie);
  const activities: (typeof activity.$inferInsert)[] = [];

  if (input.rating !== undefined && input.rating !== null) {
    activities.push({ userId, ...snapshot, type: "rated", metadata: { rating: input.rating } });
  }
  if (input.review !== undefined && input.review !== null && input.review.trim() !== "") {
    activities.push({ userId, ...snapshot, type: "reviewed" });
  }
  // Só ao marcar, nunca ao desmarcar — mesmo espírito de "desfavoritar não
  // gera atividade" e de season_watched em série.
  if (input.watched === true) {
    activities.push({ userId, ...snapshot, type: "watched" });
  }

  if (activities.length > 0) {
    await db.insert(activity).values(activities);
  }
}

export async function getMovieEntryForUser(
  db: Db,
  userId: string,
  tmdbId: number,
): Promise<MovieEntry | null> {
  const row = await db.query.movieEntry.findFirst({
    where: and(eq(movieEntry.userId, userId), eq(movieEntry.movieId, tmdbId)),
  });
  return row ? toMovieEntry(row) : null;
}

export async function upsertMovieEntry(
  env: Env,
  db: Db,
  userId: string,
  tmdbId: number,
  input: UpsertMovieEntryRequest,
): Promise<MovieEntry> {
  const cachedMovie = await getOrCacheMovie(env, db, tmdbId); // garante que a FK movieId existe

  const existing = await db.query.movieEntry.findFirst({
    where: and(eq(movieEntry.userId, userId), eq(movieEntry.movieId, tmdbId)),
  });

  const patch = withoutUndefined({
    rating: input.rating,
    review: input.review,
    watchedAt: input.watched === undefined ? undefined : input.watched ? new Date() : null,
  });

  const [row] = existing
    ? await db.update(movieEntry).set(patch).where(eq(movieEntry.id, existing.id)).returning()
    : await db
        .insert(movieEntry)
        .values({ userId, movieId: tmdbId, ...patch })
        .returning();

  if (!row) {
    throw new Error("Falha ao gravar a marcação do filme");
  }

  await logMovieEntryActivities(db, userId, cachedMovie, input);

  return toMovieEntry(row);
}

// Define qual filme ocupa um dos 4 slots fixos de favorito do usuário — a
// única forma de favoritar (mesmo padrão de setFavoriteSlot de jogos/série).
// Sempre sobrescreve: libera quem estava nesse slot e qualquer outro slot
// que esse mesmo filme já ocupasse, já que um filme só fica em um slot por
// vez.
export async function setFavoriteSlot(
  env: Env,
  db: Db,
  userId: string,
  slot: FavoriteSlotNumber,
  tmdbId: number,
): Promise<MovieEntry> {
  const cachedMovie = await getOrCacheMovie(env, db, tmdbId);

  await db
    .update(movieEntry)
    .set({ favoriteSlot: null })
    .where(and(eq(movieEntry.userId, userId), eq(movieEntry.favoriteSlot, slot)));
  await db
    .update(movieEntry)
    .set({ favoriteSlot: null })
    .where(and(eq(movieEntry.userId, userId), eq(movieEntry.movieId, tmdbId)));

  const existing = await db.query.movieEntry.findFirst({
    where: and(eq(movieEntry.userId, userId), eq(movieEntry.movieId, tmdbId)),
  });

  const [row] = existing
    ? await db
        .update(movieEntry)
        .set({ favoriteSlot: slot })
        .where(eq(movieEntry.id, existing.id))
        .returning()
    : await db
        .insert(movieEntry)
        .values({ userId, movieId: tmdbId, favoriteSlot: slot })
        .returning();

  if (!row) {
    throw new Error("Falha ao definir o favorito");
  }

  await db.insert(activity).values({ userId, ...toActivitySnapshot(cachedMovie), type: "favorited" });

  return toMovieEntry(row);
}

// Sempre os 4 slots, preenchidos ou não — quem chama decide o que fazer com
// os vazios (ex.: mostrar um placeholder "+" só na própria home).
export async function getFavoriteSlots(db: Db, userId: string): Promise<MovieFavoriteSlot[]> {
  const rows = await db.query.movieEntry.findMany({
    where: and(eq(movieEntry.userId, userId), isNotNull(movieEntry.favoriteSlot)),
    with: { movie: true },
  });
  const bySlot = new Map(rows.map((row) => [row.favoriteSlot, row]));

  return FAVORITE_SLOTS.map((slot) => {
    const row = bySlot.get(slot);
    return {
      slot,
      entry: row
        ? { ...toMovieEntry(row), movie: mapCachedMovieToSummary(row.movie) }
        : null,
    };
  });
}

export async function deleteMovieEntry(db: Db, userId: string, tmdbId: number): Promise<void> {
  await db
    .delete(movieEntry)
    .where(and(eq(movieEntry.userId, userId), eq(movieEntry.movieId, tmdbId)));
}

export async function listMovieEntries(
  db: Db,
  userId: string,
  query: ListMovieEntriesQuery,
): Promise<{ items: MovieEntryWithMovie[]; total: number }> {
  const conditions = [eq(movieEntry.userId, userId)];
  if (query.favorite !== undefined) {
    conditions.push(
      query.favorite ? isNotNull(movieEntry.favoriteSlot) : isNull(movieEntry.favoriteSlot),
    );
  }
  if (query.watched !== undefined) {
    conditions.push(query.watched ? isNotNull(movieEntry.watchedAt) : isNull(movieEntry.watchedAt));
  }
  const where = and(...conditions);

  const sortColumn = SORT_COLUMNS[query.sortBy];
  const orderBy = query.order === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [rows, countResult] = await Promise.all([
    db.query.movieEntry.findMany({
      where,
      orderBy,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      with: { movie: true },
    }),
    db.select({ count: sql<number>`count(*)` }).from(movieEntry).where(where),
  ]);

  return {
    items: rows.map((row) => ({ ...toMovieEntry(row), movie: mapCachedMovieToSummary(row.movie) })),
    total: countResult[0]?.count ?? 0,
  };
}

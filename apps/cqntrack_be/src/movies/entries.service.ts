import type {
  ListMovieEntriesQuery,
  MovieEntry,
  MovieEntryWithMovie,
  UpsertMovieEntryRequest,
} from "@cqntrack/shared";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, movieEntry } from "../db/schema";
import { withoutUndefined } from "../lib/without-undefined";
import {
  type CachedMovie,
  getOrCacheMovie,
  mapCachedMovieToSummary,
  toActivitySnapshot,
} from "./movies.service";

type Db = ReturnType<typeof createDb>;
type MovieEntryRow = typeof movieEntry.$inferSelect;

const SORT_COLUMNS = {
  status: movieEntry.status,
  rating: movieEntry.rating,
  favorite: movieEntry.favoritedAt,
  updatedAt: movieEntry.updatedAt,
} as const;

function toMovieEntry(row: MovieEntryRow): MovieEntry {
  return {
    id: row.id,
    status: row.status,
    rating: row.rating,
    watchedAt: row.watchedAt ? row.watchedAt.toISOString() : null,
    favoritedAt: row.favoritedAt?.toISOString() ?? null,
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

  // Só loga quando um status real é definido — desmarcar (status: null),
  // como desfavoritar, não vira atividade no feed. Mesmo tipo já usado por
  // jogo/livro ("status_changed") — filme agora também é status-based.
  if (input.status !== undefined && input.status !== null) {
    activities.push({
      userId,
      ...snapshot,
      type: "status_changed",
      metadata: { status: input.status },
    });
  }
  if (input.rating !== undefined && input.rating !== null) {
    activities.push({ userId, ...snapshot, type: "rated", metadata: { rating: input.rating } });
  }
  if (input.review !== undefined && input.review !== null && input.review.trim() !== "") {
    activities.push({ userId, ...snapshot, type: "reviewed" });
  }
  // Só ao favoritar, nunca ao desfavoritar — mesmo espírito de "desmarcar
  // status não gera atividade".
  if (input.favorited === true) {
    activities.push({ userId, ...snapshot, type: "favorited" });
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
  // logActivity: false pra import em massa (ver import.service.ts) — 700
  // linhas de "status_changed" de uma vez enterrariam o feed de atividade
  // de verdade. fetchCredits/fetchOverviewFallback: false, mesmo motivo —
  // pulam requests extras (elenco/direção, e a segunda busca de sinopse em
  // inglês) pra não estourar os 10ms de CPU do plano Free de Workers.
  options: { logActivity?: boolean; fetchCredits?: boolean; fetchOverviewFallback?: boolean } = {},
): Promise<MovieEntry> {
  const cachedMovie = await getOrCacheMovie(env, db, tmdbId, {
    fetchCredits: options.fetchCredits,
    fetchOverviewFallback: options.fetchOverviewFallback,
  }); // garante que a FK movieId existe

  const existing = await db.query.movieEntry.findFirst({
    where: and(eq(movieEntry.userId, userId), eq(movieEntry.movieId, tmdbId)),
  });

  const patch = withoutUndefined({
    status: input.status,
    rating: input.rating,
    review: input.review,
    // watchedAt é derivado do status: só existe quando o status vira
    // "watched" — não é mais um toggle independente.
    watchedAt:
      input.status === undefined ? undefined : input.status === "watched" ? new Date() : null,
    favoritedAt: input.favorited === undefined ? undefined : input.favorited ? new Date() : null,
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

  if (options.logActivity !== false) {
    await logMovieEntryActivities(db, userId, cachedMovie, input);
  }

  return toMovieEntry(row);
}

// Sem limite de quantidade — todo filme com favoritedAt preenchido, mais
// recente primeiro.
export async function getFavorites(db: Db, userId: string): Promise<MovieEntryWithMovie[]> {
  const rows = await db.query.movieEntry.findMany({
    where: and(eq(movieEntry.userId, userId), isNotNull(movieEntry.favoritedAt)),
    orderBy: desc(movieEntry.favoritedAt),
    with: { movie: true },
  });

  return rows.map((row) => ({ ...toMovieEntry(row), movie: mapCachedMovieToSummary(row.movie) }));
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
  if (query.status) {
    conditions.push(eq(movieEntry.status, query.status));
  }
  if (query.favorite !== undefined) {
    conditions.push(
      query.favorite ? isNotNull(movieEntry.favoritedAt) : isNull(movieEntry.favoritedAt),
    );
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
    db
      .select({ count: sql<number>`count(*)` })
      .from(movieEntry)
      .where(where),
  ]);

  return {
    items: rows.map((row) => ({ ...toMovieEntry(row), movie: mapCachedMovieToSummary(row.movie) })),
    total: countResult[0]?.count ?? 0,
  };
}

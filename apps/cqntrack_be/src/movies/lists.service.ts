import type {
  CreateMovieListRequest,
  MovieList,
  MovieListDetail,
  UpdateMovieListRequest,
} from "@cqntrack/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, movieList, movieListItem } from "../db/schema";
import { isUniqueConstraintError } from "../lib/is-unique-constraint-error";
import { withoutUndefined } from "../lib/without-undefined";
import { getOrCacheMovie, mapCachedMovieToSummary, toActivitySnapshot } from "./movies.service";

type Db = ReturnType<typeof createDb>;
type MovieListRow = typeof movieList.$inferSelect;

export class MovieListNotFoundError extends Error {
  constructor(public readonly listId: string) {
    super(`Lista ${listId} não encontrada`);
    this.name = "MovieListNotFoundError";
  }
}

export class DuplicateMovieListNameError extends Error {
  constructor(public readonly name: string) {
    super(`Já existe uma lista chamada "${name}"`);
    this.name = "DuplicateMovieListNameError";
  }
}

async function withItemCount(db: Db, rows: MovieListRow[]): Promise<MovieList[]> {
  if (rows.length === 0) {
    return [];
  }

  const counts = await db
    .select({ listId: movieListItem.listId, count: sql<number>`count(*)` })
    .from(movieListItem)
    .where(
      inArray(
        movieListItem.listId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(movieListItem.listId);
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
async function getOwnedMovieList(db: Db, userId: string, listId: string): Promise<MovieListRow> {
  const [row] = await db
    .select()
    .from(movieList)
    .where(and(eq(movieList.id, listId), eq(movieList.userId, userId)));
  if (!row) {
    throw new MovieListNotFoundError(listId);
  }
  return row;
}

export async function listMovieLists(db: Db, userId: string): Promise<MovieList[]> {
  const rows = await db
    .select()
    .from(movieList)
    .where(eq(movieList.userId, userId))
    .orderBy(desc(movieList.updatedAt));
  return withItemCount(db, rows);
}

export async function createMovieList(
  db: Db,
  userId: string,
  input: CreateMovieListRequest,
): Promise<MovieList> {
  try {
    const [row] = await db
      .insert(movieList)
      .values({ userId, name: input.name, description: input.description ?? null })
      .returning();
    if (!row) {
      throw new Error("Falha ao criar lista");
    }
    const [list] = await withItemCount(db, [row]);
    return list!;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateMovieListNameError(input.name);
    }
    throw error;
  }
}

export async function updateMovieList(
  db: Db,
  userId: string,
  listId: string,
  input: UpdateMovieListRequest,
): Promise<MovieList> {
  await getOwnedMovieList(db, userId, listId);

  const patch = withoutUndefined({ name: input.name, description: input.description });

  try {
    const [row] =
      Object.keys(patch).length > 0
        ? await db.update(movieList).set(patch).where(eq(movieList.id, listId)).returning()
        : await db.select().from(movieList).where(eq(movieList.id, listId));
    if (!row) {
      throw new Error("Falha ao atualizar lista");
    }
    const [list] = await withItemCount(db, [row]);
    return list!;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateMovieListNameError(input.name ?? "");
    }
    throw error;
  }
}

export async function deleteMovieList(db: Db, userId: string, listId: string): Promise<void> {
  await getOwnedMovieList(db, userId, listId);
  await db.delete(movieList).where(eq(movieList.id, listId));
}

export async function getMovieListDetail(
  db: Db,
  userId: string,
  listId: string,
): Promise<MovieListDetail> {
  const row = await getOwnedMovieList(db, userId, listId);

  const items = await db.query.movieListItem.findMany({
    where: eq(movieListItem.listId, listId),
    orderBy: desc(movieListItem.addedAt),
    with: { movie: true },
  });

  const [list] = await withItemCount(db, [row]);
  return {
    ...list!,
    items: items.map((item) => mapCachedMovieToSummary(item.movie)),
  };
}

export async function addMovieToList(
  env: Env,
  db: Db,
  userId: string,
  listId: string,
  tmdbId: number,
): Promise<void> {
  const list = await getOwnedMovieList(db, userId, listId);
  const cachedMovie = await getOrCacheMovie(env, db, tmdbId); // garante a FK movieId

  const inserted = await db
    .insert(movieListItem)
    .values({ listId, movieId: tmdbId })
    .onConflictDoNothing()
    .returning();

  // Só loga atividade se o filme realmente entrou agora (evita duplicar o
  // registro quando ele já estava na lista).
  if (inserted.length > 0) {
    await db.insert(activity).values({
      userId,
      ...toActivitySnapshot(cachedMovie),
      type: "added_to_list",
      metadata: { listId, listName: list.name },
    });
  }
}

export async function removeMovieFromList(
  db: Db,
  userId: string,
  listId: string,
  tmdbId: number,
): Promise<void> {
  await getOwnedMovieList(db, userId, listId);
  await db
    .delete(movieListItem)
    .where(and(eq(movieListItem.listId, listId), eq(movieListItem.movieId, tmdbId)));
}

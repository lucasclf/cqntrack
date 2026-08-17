import type {
  CreateSeriesListRequest,
  SeriesList,
  SeriesListDetail,
  UpdateSeriesListRequest,
} from "@cqntrack/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, seriesList, seriesListItem } from "../db/schema";
import { isUniqueConstraintError } from "../lib/is-unique-constraint-error";
import { withoutUndefined } from "../lib/without-undefined";
import { getOrCacheSeries, mapCachedSeriesToSummary, toActivitySnapshot } from "./series.service";

type Db = ReturnType<typeof createDb>;
type SeriesListRow = typeof seriesList.$inferSelect;

export class SeriesListNotFoundError extends Error {
  constructor(public readonly listId: string) {
    super(`Lista ${listId} não encontrada`);
    this.name = "SeriesListNotFoundError";
  }
}

export class DuplicateSeriesListNameError extends Error {
  constructor(public readonly name: string) {
    super(`Já existe uma lista chamada "${name}"`);
    this.name = "DuplicateSeriesListNameError";
  }
}

async function withItemCount(db: Db, rows: SeriesListRow[]): Promise<SeriesList[]> {
  if (rows.length === 0) {
    return [];
  }

  const counts = await db
    .select({ listId: seriesListItem.listId, count: sql<number>`count(*)` })
    .from(seriesListItem)
    .where(
      inArray(
        seriesListItem.listId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(seriesListItem.listId);
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
async function getOwnedSeriesList(db: Db, userId: string, listId: string): Promise<SeriesListRow> {
  const [row] = await db
    .select()
    .from(seriesList)
    .where(and(eq(seriesList.id, listId), eq(seriesList.userId, userId)));
  if (!row) {
    throw new SeriesListNotFoundError(listId);
  }
  return row;
}

export async function listSeriesLists(db: Db, userId: string): Promise<SeriesList[]> {
  const rows = await db
    .select()
    .from(seriesList)
    .where(eq(seriesList.userId, userId))
    .orderBy(desc(seriesList.updatedAt));
  return withItemCount(db, rows);
}

export async function createSeriesList(
  db: Db,
  userId: string,
  input: CreateSeriesListRequest,
): Promise<SeriesList> {
  try {
    const [row] = await db
      .insert(seriesList)
      .values({ userId, name: input.name, description: input.description ?? null })
      .returning();
    if (!row) {
      throw new Error("Falha ao criar lista");
    }
    const [list] = await withItemCount(db, [row]);
    return list!;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateSeriesListNameError(input.name);
    }
    throw error;
  }
}

export async function updateSeriesList(
  db: Db,
  userId: string,
  listId: string,
  input: UpdateSeriesListRequest,
): Promise<SeriesList> {
  await getOwnedSeriesList(db, userId, listId);

  const patch = withoutUndefined({ name: input.name, description: input.description });

  try {
    const [row] =
      Object.keys(patch).length > 0
        ? await db.update(seriesList).set(patch).where(eq(seriesList.id, listId)).returning()
        : await db.select().from(seriesList).where(eq(seriesList.id, listId));
    if (!row) {
      throw new Error("Falha ao atualizar lista");
    }
    const [list] = await withItemCount(db, [row]);
    return list!;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateSeriesListNameError(input.name ?? "");
    }
    throw error;
  }
}

export async function deleteSeriesList(db: Db, userId: string, listId: string): Promise<void> {
  await getOwnedSeriesList(db, userId, listId);
  await db.delete(seriesList).where(eq(seriesList.id, listId));
}

export async function getSeriesListDetail(
  db: Db,
  userId: string,
  listId: string,
): Promise<SeriesListDetail> {
  const row = await getOwnedSeriesList(db, userId, listId);

  const items = await db.query.seriesListItem.findMany({
    where: eq(seriesListItem.listId, listId),
    orderBy: desc(seriesListItem.addedAt),
    with: { series: true },
  });

  const [list] = await withItemCount(db, [row]);
  return {
    ...list!,
    items: items.map((item) => mapCachedSeriesToSummary(item.series)),
  };
}

export async function addSeriesToList(
  env: Env,
  db: Db,
  userId: string,
  listId: string,
  tmdbId: number,
): Promise<void> {
  const list = await getOwnedSeriesList(db, userId, listId);
  const cachedSeries = await getOrCacheSeries(env, db, tmdbId); // garante a FK seriesId

  const inserted = await db
    .insert(seriesListItem)
    .values({ listId, seriesId: tmdbId })
    .onConflictDoNothing()
    .returning();

  // Só loga atividade se a série realmente entrou agora (evita duplicar o
  // registro quando ela já estava na lista).
  if (inserted.length > 0) {
    await db.insert(activity).values({
      userId,
      ...toActivitySnapshot(cachedSeries),
      type: "added_to_list",
      metadata: { listId, listName: list.name },
    });
  }
}

export async function removeSeriesFromList(
  db: Db,
  userId: string,
  listId: string,
  tmdbId: number,
): Promise<void> {
  await getOwnedSeriesList(db, userId, listId);
  await db
    .delete(seriesListItem)
    .where(and(eq(seriesListItem.listId, listId), eq(seriesListItem.seriesId, tmdbId)));
}

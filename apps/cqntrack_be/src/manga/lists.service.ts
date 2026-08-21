import type {
  CreateMangaListRequest,
  MangaList,
  MangaListDetail,
  UpdateMangaListRequest,
} from "@cqntrack/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, mangaList, mangaListItem } from "../db/schema";
import { isUniqueConstraintError } from "../lib/is-unique-constraint-error";
import { withoutUndefined } from "../lib/without-undefined";
import { getOrCacheManga, mapCachedMangaToSummary, toActivitySnapshot } from "./manga.service";

type Db = ReturnType<typeof createDb>;
type MangaListRow = typeof mangaList.$inferSelect;

export class MangaListNotFoundError extends Error {
  constructor(public readonly listId: string) {
    super(`Lista ${listId} não encontrada`);
    this.name = "MangaListNotFoundError";
  }
}

export class DuplicateMangaListNameError extends Error {
  constructor(public readonly name: string) {
    super(`Já existe uma lista chamada "${name}"`);
    this.name = "DuplicateMangaListNameError";
  }
}

async function withItemCount(db: Db, rows: MangaListRow[]): Promise<MangaList[]> {
  if (rows.length === 0) {
    return [];
  }

  const counts = await db
    .select({ listId: mangaListItem.listId, count: sql<number>`count(*)` })
    .from(mangaListItem)
    .where(
      inArray(
        mangaListItem.listId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(mangaListItem.listId);
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
async function getOwnedMangaList(db: Db, userId: string, listId: string): Promise<MangaListRow> {
  const [row] = await db
    .select()
    .from(mangaList)
    .where(and(eq(mangaList.id, listId), eq(mangaList.userId, userId)));
  if (!row) {
    throw new MangaListNotFoundError(listId);
  }
  return row;
}

export async function listMangaLists(db: Db, userId: string): Promise<MangaList[]> {
  const rows = await db
    .select()
    .from(mangaList)
    .where(eq(mangaList.userId, userId))
    .orderBy(desc(mangaList.updatedAt));
  return withItemCount(db, rows);
}

export async function createMangaList(
  db: Db,
  userId: string,
  input: CreateMangaListRequest,
): Promise<MangaList> {
  try {
    const [row] = await db
      .insert(mangaList)
      .values({ userId, name: input.name, description: input.description ?? null })
      .returning();
    if (!row) {
      throw new Error("Falha ao criar lista");
    }
    const [list] = await withItemCount(db, [row]);
    return list!;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateMangaListNameError(input.name);
    }
    throw error;
  }
}

export async function updateMangaList(
  db: Db,
  userId: string,
  listId: string,
  input: UpdateMangaListRequest,
): Promise<MangaList> {
  await getOwnedMangaList(db, userId, listId);

  const patch = withoutUndefined({ name: input.name, description: input.description });

  try {
    const [row] =
      Object.keys(patch).length > 0
        ? await db.update(mangaList).set(patch).where(eq(mangaList.id, listId)).returning()
        : await db.select().from(mangaList).where(eq(mangaList.id, listId));
    if (!row) {
      throw new Error("Falha ao atualizar lista");
    }
    const [list] = await withItemCount(db, [row]);
    return list!;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateMangaListNameError(input.name ?? "");
    }
    throw error;
  }
}

export async function deleteMangaList(db: Db, userId: string, listId: string): Promise<void> {
  await getOwnedMangaList(db, userId, listId);
  await db.delete(mangaList).where(eq(mangaList.id, listId));
}

export async function getMangaListDetail(
  db: Db,
  userId: string,
  listId: string,
): Promise<MangaListDetail> {
  const row = await getOwnedMangaList(db, userId, listId);

  const items = await db.query.mangaListItem.findMany({
    where: eq(mangaListItem.listId, listId),
    orderBy: desc(mangaListItem.addedAt),
    with: { manga: true },
  });

  const [list] = await withItemCount(db, [row]);
  return {
    ...list!,
    items: items.map((item) => mapCachedMangaToSummary(item.manga)),
  };
}

export async function addMangaToList(
  db: Db,
  userId: string,
  listId: string,
  mangadexId: string,
): Promise<void> {
  const list = await getOwnedMangaList(db, userId, listId);
  const cachedManga = await getOrCacheManga(db, mangadexId); // garante a FK mangaId

  const inserted = await db
    .insert(mangaListItem)
    .values({ listId, mangaId: mangadexId })
    .onConflictDoNothing()
    .returning();

  // Só loga atividade se o mangá realmente entrou agora (evita duplicar o
  // registro quando ele já estava na lista).
  if (inserted.length > 0) {
    await db.insert(activity).values({
      userId,
      ...toActivitySnapshot(cachedManga),
      type: "added_to_list",
      metadata: { listId, listName: list.name },
    });
  }
}

export async function removeMangaFromList(
  db: Db,
  userId: string,
  listId: string,
  mangadexId: string,
): Promise<void> {
  await getOwnedMangaList(db, userId, listId);
  await db
    .delete(mangaListItem)
    .where(and(eq(mangaListItem.listId, listId), eq(mangaListItem.mangaId, mangadexId)));
}

import type {
  ListMangaEntriesQuery,
  MangaEntry,
  MangaEntryWithManga,
  MangaSummary,
  MangaSummaryWithEntry,
  UpsertMangaEntryRequest,
} from "@cqntrack/shared";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { createDb } from "../db/client";
import { activity, mangaChapterRead, mangaEntry } from "../db/schema";
import { withoutUndefined } from "../lib/without-undefined";
import {
  type CachedManga,
  getOrCacheManga,
  mapCachedMangaToSummary,
  toActivitySnapshot,
} from "./manga.service";

type Db = ReturnType<typeof createDb>;
type MangaEntryRow = typeof mangaEntry.$inferSelect;

const SORT_COLUMNS = {
  status: mangaEntry.status,
  rating: mangaEntry.rating,
  favorite: mangaEntry.favoritedAt,
  updatedAt: mangaEntry.updatedAt,
} as const;

// Uma query em lote por mangá — mesmo espírito de getWatchedSummaries
// (série), evita N+1 em listMangaEntries/getFavorites. Bem mais simples que
// o equivalente de série (sem "próximo episódio disponível" pra cruzar,
// porque a MangaDex não é cacheada com isso — ver manga.schema.ts).
async function getReadChapterCounts(
  db: Db,
  userId: string,
  mangaIds: string[],
): Promise<Map<string, number>> {
  if (mangaIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({ mangaId: mangaChapterRead.mangaId, count: sql<number>`count(*)` })
    .from(mangaChapterRead)
    .where(and(eq(mangaChapterRead.userId, userId), inArray(mangaChapterRead.mangaId, mangaIds)))
    .groupBy(mangaChapterRead.mangaId);
  return new Map(rows.map((row) => [row.mangaId, row.count]));
}

async function getReadChapterCount(db: Db, userId: string, mangaId: string): Promise<number> {
  const counts = await getReadChapterCounts(db, userId, [mangaId]);
  return counts.get(mangaId) ?? 0;
}

function toMangaEntry(row: MangaEntryRow, readChapterCount: number): MangaEntry {
  return {
    id: row.id,
    status: row.status,
    rating: row.rating,
    readChapterCount,
    favoritedAt: row.favoritedAt?.toISOString() ?? null,
    review: row.review,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function logMangaEntryActivities(
  db: Db,
  userId: string,
  cachedManga: CachedManga,
  input: UpsertMangaEntryRequest,
): Promise<void> {
  const snapshot = toActivitySnapshot(cachedManga);
  const activities: (typeof activity.$inferInsert)[] = [];

  // Só loga quando um status real é definido — desmarcar (status: null),
  // como desfavoritar, não vira atividade no feed. Mesmo tipo já usado por
  // jogo/livro ("status_changed").
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

// Garante que existe uma marcação (mesmo que vazia, status: null) antes de
// gravar um capítulo lido — mesmo espírito de ensureSeriesEntry: marcar
// capítulo sem nunca ter tocado no status/nota não deveria deixar o mangá
// de fora de "Minhas marcações" (listMangaEntries lê da tabela mangaEntry).
export async function ensureMangaEntry(
  env: Env,
  db: Db,
  userId: string,
  mangadexId: string,
): Promise<{ cachedManga: CachedManga; row: MangaEntryRow }> {
  const cachedManga = await getOrCacheManga(env, db, mangadexId);
  const existing = await db.query.mangaEntry.findFirst({
    where: and(eq(mangaEntry.userId, userId), eq(mangaEntry.mangaId, mangadexId)),
  });
  if (existing) {
    return { cachedManga, row: existing };
  }
  const [row] = await db.insert(mangaEntry).values({ userId, mangaId: mangadexId }).returning();
  if (!row) {
    throw new Error("Falha ao criar a marcação do mangá");
  }
  return { cachedManga, row };
}

export async function getMangaEntryForUser(
  db: Db,
  userId: string,
  mangadexId: string,
): Promise<MangaEntry | null> {
  const row = await db.query.mangaEntry.findFirst({
    where: and(eq(mangaEntry.userId, userId), eq(mangaEntry.mangaId, mangadexId)),
  });
  if (!row) return null;
  const readChapterCount = await getReadChapterCount(db, userId, mangadexId);
  return toMangaEntry(row, readChapterCount);
}

// Lookup em lote — dado um conjunto de mangás já resolvidos (busca/descobrir
// MangaDex, item de lista), busca de uma vez as entries do usuário pra
// anexar a cada um (ações rápidas do Card, sem precisar entrar no
// detalhe). Mesmo espírito de attachEntriesToGames.
export async function attachEntriesToManga(
  db: Db,
  userId: string,
  mangaList: MangaSummary[],
): Promise<MangaSummaryWithEntry[]> {
  if (mangaList.length === 0) return [];

  const rows = await db.query.mangaEntry.findMany({
    where: and(
      eq(mangaEntry.userId, userId),
      inArray(
        mangaEntry.mangaId,
        mangaList.map((item) => item.mangadexId),
      ),
    ),
  });
  const counts = await getReadChapterCounts(
    db,
    userId,
    rows.map((row) => row.mangaId),
  );
  const entriesByMangaId = new Map(
    rows.map((row) => [row.mangaId, toMangaEntry(row, counts.get(row.mangaId) ?? 0)]),
  );

  return mangaList.map((item) => ({
    ...item,
    entry: entriesByMangaId.get(item.mangadexId) ?? null,
  }));
}

export async function upsertMangaEntry(
  env: Env,
  db: Db,
  userId: string,
  mangadexId: string,
  input: UpsertMangaEntryRequest,
): Promise<MangaEntry> {
  const cachedManga = await getOrCacheManga(env, db, mangadexId); // garante que a FK mangaId existe

  const existing = await db.query.mangaEntry.findFirst({
    where: and(eq(mangaEntry.userId, userId), eq(mangaEntry.mangaId, mangadexId)),
  });

  const patch = withoutUndefined({
    status: input.status,
    rating: input.rating,
    review: input.review,
    favoritedAt: input.favorited === undefined ? undefined : input.favorited ? new Date() : null,
  });

  const [row] = existing
    ? await db.update(mangaEntry).set(patch).where(eq(mangaEntry.id, existing.id)).returning()
    : await db
        .insert(mangaEntry)
        .values({ userId, mangaId: mangadexId, ...patch })
        .returning();

  if (!row) {
    throw new Error("Falha ao gravar a marcação do mangá");
  }

  await logMangaEntryActivities(db, userId, cachedManga, input);

  const readChapterCount = await getReadChapterCount(db, userId, mangadexId);
  return toMangaEntry(row, readChapterCount);
}

// Sem limite de quantidade — todo mangá com favoritedAt preenchido, mais
// recente primeiro.
export async function getFavorites(db: Db, userId: string): Promise<MangaEntryWithManga[]> {
  const rows = await db.query.mangaEntry.findMany({
    where: and(eq(mangaEntry.userId, userId), isNotNull(mangaEntry.favoritedAt)),
    orderBy: desc(mangaEntry.favoritedAt),
    with: { manga: true },
  });

  const counts = await getReadChapterCounts(
    db,
    userId,
    rows.map((row) => row.mangaId),
  );

  return rows.map((row) => ({
    ...toMangaEntry(row, counts.get(row.mangaId) ?? 0),
    manga: mapCachedMangaToSummary(row.manga),
  }));
}

export async function deleteMangaEntry(db: Db, userId: string, mangadexId: string): Promise<void> {
  await db
    .delete(mangaEntry)
    .where(and(eq(mangaEntry.userId, userId), eq(mangaEntry.mangaId, mangadexId)));
}

export async function listMangaEntries(
  db: Db,
  userId: string,
  query: ListMangaEntriesQuery,
): Promise<{ items: MangaEntryWithManga[]; total: number }> {
  const conditions = [eq(mangaEntry.userId, userId)];
  if (query.status) {
    conditions.push(eq(mangaEntry.status, query.status));
  }
  if (query.favorite !== undefined) {
    conditions.push(
      query.favorite ? isNotNull(mangaEntry.favoritedAt) : isNull(mangaEntry.favoritedAt),
    );
  }
  const where = and(...conditions);

  const sortColumn = SORT_COLUMNS[query.sortBy];
  const orderBy = query.order === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [rows, countResult] = await Promise.all([
    db.query.mangaEntry.findMany({
      where,
      orderBy,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
      with: { manga: true },
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mangaEntry)
      .where(where),
  ]);

  const counts = await getReadChapterCounts(
    db,
    userId,
    rows.map((row) => row.mangaId),
  );

  return {
    items: rows.map((row) => ({
      ...toMangaEntry(row, counts.get(row.mangaId) ?? 0),
      manga: mapCachedMangaToSummary(row.manga),
    })),
    total: countResult[0]?.count ?? 0,
  };
}

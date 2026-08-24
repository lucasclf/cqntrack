import {
  AuthorMangaResponseSchema,
  DiscoverMangaQuerySchema,
  DiscoverMangaResponseSchema,
  ListMangaEntriesQuerySchema,
  MangaDetailResponseSchema,
  MangaEntrySchema,
  MangaFavoritesResponseSchema,
  MangaVolumesResponseSchema,
  PaginatedMangaEntriesResponseSchema,
  SearchMangaQuerySchema,
  SearchMangaResponseSchema,
  SetChapterReadRequestSchema,
  UpsertMangaEntryRequestSchema,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import { getAuthorManga } from "./authors.service";
import {
  getMangaVolumes,
  setAllChaptersRead,
  setChapterRead,
  setVolumeRead,
} from "./chapters.service";
import {
  deleteMangaEntry,
  getMangaEntryForUser,
  getFavorites,
  listMangaEntries,
  upsertMangaEntry,
} from "./entries.service";
import {
  discoverMangaForUser,
  getOrCacheManga,
  mapCachedMangaToSummary,
  MangaNotFoundError,
  searchMangaForUser,
} from "./manga.service";

export const mangaRouter = new Hono<AuthedEnv>();

mangaRouter.use("*", requireSession);

function parseMangadexId(c: { req: { param: (name: string) => string } }): string | null {
  const mangadexId = c.req.param("mangadexId");
  return mangadexId.length > 0 ? mangadexId : null;
}

// volumeNumber é sempre inteiro (0 = sentinela "sem volume", ver
// manga.schema.ts) — chapterNumber pode ser decimal ("10.5"), por isso usa
// Number.isFinite em vez de Number.isInteger.
function parseVolumeNumber(c: { req: { param: (name: string) => string } }): number | null {
  const value = Number(c.req.param("volumeNumber"));
  return Number.isInteger(value) ? value : null;
}

function parseChapterNumber(c: { req: { param: (name: string) => string } }): number | null {
  const value = Number(c.req.param("chapterNumber"));
  return Number.isFinite(value) ? value : null;
}

// Rotas estáticas (/search, /discover, /entries, /favorites, /authors/:id)
// precisam vir ANTES de /:mangadexId — senão o parâmetro dinâmico captura o
// segmento literal (mesma pegadinha já documentada nas outras seções).
mangaRouter.get("/search", async (c) => {
  const parsed = SearchMangaQuerySchema.safeParse({
    q: c.req.query("q"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const results = await searchMangaForUser(parsed.data.q, parsed.data.limit);
  return c.json(SearchMangaResponseSchema.parse({ results }));
});

mangaRouter.get("/discover", async (c) => {
  const parsed = DiscoverMangaQuerySchema.safeParse({ page: c.req.query("page") });
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const { results, hasMore } = await discoverMangaForUser(parsed.data.page);
  return c.json(DiscoverMangaResponseSchema.parse({ results, page: parsed.data.page, hasMore }));
});

mangaRouter.get("/entries", async (c) => {
  const parsed = ListMangaEntriesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  const { items, total } = await listMangaEntries(db, c.get("userId"), parsed.data);

  const body = PaginatedMangaEntriesResponseSchema.parse({
    items,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total,
  });
  return c.json(body);
});

mangaRouter.get("/favorites", async (c) => {
  const db = createDb(c.env);
  const items = await getFavorites(db, c.get("userId"));
  return c.json(MangaFavoritesResponseSchema.parse({ items }));
});

mangaRouter.get("/authors/:authorId", async (c) => {
  const authorId = c.req.param("authorId");
  if (!authorId) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const result = await getAuthorManga(authorId);
  if (!result) {
    return c.json({ error: "author_not_found" }, 404);
  }
  return c.json(AuthorMangaResponseSchema.parse(result));
});

mangaRouter.get("/:mangadexId", async (c) => {
  const mangadexId = parseMangadexId(c);
  if (mangadexId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    const cachedManga = await getOrCacheManga(db, mangadexId);
    const entry = await getMangaEntryForUser(db, c.get("userId"), mangadexId);

    const body = MangaDetailResponseSchema.parse({
      manga: { ...mapCachedMangaToSummary(cachedManga), description: cachedManga.description },
      entry,
    });
    return c.json(body);
  } catch (error) {
    if (error instanceof MangaNotFoundError) {
      return c.json({ error: "manga_not_found" }, 404);
    }
    throw error;
  }
});

mangaRouter.put("/:mangadexId/entry", async (c) => {
  const mangadexId = parseMangadexId(c);
  if (mangadexId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = UpsertMangaEntryRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const entry = await upsertMangaEntry(db, c.get("userId"), mangadexId, parsed.data);
    return c.json(MangaEntrySchema.parse(entry));
  } catch (error) {
    if (error instanceof MangaNotFoundError) {
      return c.json({ error: "manga_not_found" }, 404);
    }
    throw error;
  }
});

mangaRouter.delete("/:mangadexId/entry", async (c) => {
  const mangadexId = parseMangadexId(c);
  if (mangadexId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  await deleteMangaEntry(db, c.get("userId"), mangadexId);
  return c.body(null, 204);
});

mangaRouter.get("/:mangadexId/volumes", async (c) => {
  const mangadexId = parseMangadexId(c);
  if (mangadexId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  const volumes = await getMangaVolumes(db, c.get("userId"), mangadexId);
  return c.json(MangaVolumesResponseSchema.parse(volumes));
});

mangaRouter.put("/:mangadexId/chapters/:volumeNumber/:chapterNumber", async (c) => {
  const mangadexId = parseMangadexId(c);
  const volumeNumber = parseVolumeNumber(c);
  const chapterNumber = parseChapterNumber(c);
  if (mangadexId === null || volumeNumber === null || chapterNumber === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = SetChapterReadRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  await setChapterRead(
    db,
    c.get("userId"),
    mangadexId,
    volumeNumber,
    chapterNumber,
    parsed.data.read,
  );
  return c.body(null, 204);
});

mangaRouter.put("/:mangadexId/volumes/:volumeNumber", async (c) => {
  const mangadexId = parseMangadexId(c);
  const volumeNumber = parseVolumeNumber(c);
  if (mangadexId === null || volumeNumber === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = SetChapterReadRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  const found = await setVolumeRead(
    db,
    c.get("userId"),
    mangadexId,
    volumeNumber,
    parsed.data.read,
  );
  if (!found) {
    return c.json({ error: "volume_not_found" }, 404);
  }
  return c.body(null, 204);
});

mangaRouter.put("/:mangadexId/read-all", async (c) => {
  const mangadexId = parseMangadexId(c);
  if (mangadexId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  await setAllChaptersRead(db, c.get("userId"), mangadexId);
  return c.body(null, 204);
});

import {
  BookDetailResponseSchema,
  BookEntrySchema,
  BookFavoritesResponseSchema,
  FAVORITE_SLOTS,
  ListBookEntriesQuerySchema,
  PaginatedBookEntriesResponseSchema,
  SearchBooksQuerySchema,
  SearchBooksResponseSchema,
  SetBookFavoriteSlotRequestSchema,
  UpsertBookEntryRequestSchema,
  type FavoriteSlotNumber,
} from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import { BookNotFoundError, getOrCacheBook, mapCachedBookToSummary, searchBooksForUser } from "./books.service";
import {
  deleteBookEntry,
  getBookEntryForUser,
  getFavoriteSlots,
  listBookEntries,
  setFavoriteSlot,
  upsertBookEntry,
} from "./entries.service";

export const booksRouter = new Hono<AuthedEnv>();

booksRouter.use("*", requireSession);

function parseGoogleBooksId(c: { req: { param: (name: string) => string } }): string | null {
  const googleBooksId = c.req.param("googleBooksId");
  return googleBooksId.length > 0 ? googleBooksId : null;
}

function parseFavoriteSlot(c: {
  req: { param: (name: string) => string };
}): FavoriteSlotNumber | null {
  const slot = Number(c.req.param("slot"));
  return FAVORITE_SLOTS.includes(slot as FavoriteSlotNumber) ? (slot as FavoriteSlotNumber) : null;
}

// Rotas estáticas (/search, /entries, /favorites) precisam vir ANTES de
// /:googleBooksId — senão o parâmetro dinâmico captura o segmento literal
// (mesma pegadinha já documentada pra /api/games, /api/series e /api/movies).
booksRouter.get("/search", async (c) => {
  const parsed = SearchBooksQuerySchema.safeParse({
    q: c.req.query("q"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const results = await searchBooksForUser(c.env, parsed.data.q, parsed.data.limit);

  const body = SearchBooksResponseSchema.parse({ results });
  return c.json(body);
});

booksRouter.get("/entries", async (c) => {
  const parsed = ListBookEntriesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "invalid_query" }, 400);
  }

  const db = createDb(c.env);
  const { items, total } = await listBookEntries(db, c.get("userId"), parsed.data);

  const body = PaginatedBookEntriesResponseSchema.parse({
    items,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total,
  });
  return c.json(body);
});

booksRouter.get("/favorites", async (c) => {
  const db = createDb(c.env);
  const slots = await getFavoriteSlots(db, c.get("userId"));
  return c.json(BookFavoritesResponseSchema.parse({ slots }));
});

booksRouter.put("/favorites/:slot", async (c) => {
  const slot = parseFavoriteSlot(c);
  if (slot === null) {
    return c.json({ error: "invalid_slot" }, 400);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = SetBookFavoriteSlotRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const entry = await setFavoriteSlot(c.env, db, c.get("userId"), slot, parsed.data.googleBooksId);
    return c.json(BookEntrySchema.parse(entry));
  } catch (error) {
    if (error instanceof BookNotFoundError) {
      return c.json({ error: "book_not_found" }, 404);
    }
    throw error;
  }
});

booksRouter.get("/:googleBooksId", async (c) => {
  const googleBooksId = parseGoogleBooksId(c);
  if (googleBooksId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    const cachedBook = await getOrCacheBook(c.env, db, googleBooksId);
    const entry = await getBookEntryForUser(db, c.get("userId"), googleBooksId);

    const body = BookDetailResponseSchema.parse({
      book: { ...mapCachedBookToSummary(cachedBook), description: cachedBook.description },
      entry,
    });
    return c.json(body);
  } catch (error) {
    if (error instanceof BookNotFoundError) {
      return c.json({ error: "book_not_found" }, 404);
    }
    throw error;
  }
});

booksRouter.put("/:googleBooksId/entry", async (c) => {
  const googleBooksId = parseGoogleBooksId(c);
  if (googleBooksId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const json = await c.req.json().catch(() => null);
  const parsed = UpsertBookEntryRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "invalid_body" }, 400);
  }

  const db = createDb(c.env);
  try {
    const entry = await upsertBookEntry(c.env, db, c.get("userId"), googleBooksId, parsed.data);
    return c.json(BookEntrySchema.parse(entry));
  } catch (error) {
    if (error instanceof BookNotFoundError) {
      return c.json({ error: "book_not_found" }, 404);
    }
    throw error;
  }
});

booksRouter.delete("/:googleBooksId/entry", async (c) => {
  const googleBooksId = parseGoogleBooksId(c);
  if (googleBooksId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  await deleteBookEntry(db, c.get("userId"), googleBooksId);
  return c.body(null, 204);
});

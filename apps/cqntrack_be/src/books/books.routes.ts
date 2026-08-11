import { BookDetailResponseSchema, SearchBooksQuerySchema, SearchBooksResponseSchema } from "@cqntrack/shared";
import { Hono } from "hono";
import { type AuthedEnv, requireSession } from "../auth/require-session";
import { createDb } from "../db/client";
import { BookNotFoundError, getOrCacheBook, mapCachedBookToSummary, searchBooksForUser } from "./books.service";

export const booksRouter = new Hono<AuthedEnv>();

booksRouter.use("*", requireSession);

function parseGoogleBooksId(c: { req: { param: (name: string) => string } }): string | null {
  const googleBooksId = c.req.param("googleBooksId");
  return googleBooksId.length > 0 ? googleBooksId : null;
}

// Rota estática (/search) precisa vir ANTES de /:googleBooksId — senão o
// parâmetro dinâmico captura o segmento literal (mesma pegadinha já
// documentada pra /api/games, /api/series e /api/movies).
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

booksRouter.get("/:googleBooksId", async (c) => {
  const googleBooksId = parseGoogleBooksId(c);
  if (googleBooksId === null) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const db = createDb(c.env);
  try {
    const cachedBook = await getOrCacheBook(c.env, db, googleBooksId);

    const body = BookDetailResponseSchema.parse({
      book: { ...mapCachedBookToSummary(cachedBook), description: cachedBook.description },
      // Marcação do usuário ainda não existe (ver entries.service.ts, chega
      // num commit seguinte) — todo mundo vê "sem marcação" por enquanto.
      entry: null,
    });
    return c.json(body);
  } catch (error) {
    if (error instanceof BookNotFoundError) {
      return c.json({ error: "book_not_found" }, 404);
    }
    throw error;
  }
});

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { createDb } from "../db/client";
import { book } from "../db/schema";

const GOOGLE_BOOKS_SEARCH_RESULT = {
  id: "PCq3AAAAQBAJ",
  volumeInfo: {
    title: "Dom Casmurro",
    authors: ["Machado de Assis"],
    publishedDate: "1899",
    categories: ["Fiction"],
    imageLinks: { thumbnail: "http://books.google.com/books/content?id=PCq3AAAAQBAJ" },
    averageRating: 4,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function googleBooksVolume(id: string, title: string) {
  return {
    id,
    volumeInfo: {
      title,
      authors: ["Autor de Teste"],
      publishedDate: "2010-07-15",
      description: `Sinopse de ${title}`,
      categories: ["Fiction"],
      pageCount: 320,
      imageLinks: { thumbnail: `http://books.google.com/books/content?id=${id}` },
      averageRating: 4.5,
    },
  };
}

// A Google Books não tem etapa de token (diferente da IGDB) — um fetch
// mockado por chamada é suficiente.
function stubGoogleBooksFetchOnce(...responses: unknown[]): void {
  const fetchMock = vi.fn();
  for (const body of responses) {
    fetchMock.mockResolvedValueOnce(jsonResponse(body));
  }
  vi.stubGlobal("fetch", fetchMock);
}

describe("GET /api/books/search", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/books/search?q=dom+casmurro", undefined, env);

    expect(res.status).toBe(401);
  });

  it("sem o parâmetro q retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/books/search", { headers: { cookie } }, env);

    expect(res.status).toBe(400);
  });

  it("com sessão e query válida retorna os livros mapeados para o DTO (um único request à Google Books)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce({ items: [GOOGLE_BOOKS_SEARCH_RESULT], totalItems: 1 });

    const res = await app.request("/api/books/search?q=dom+casmurro", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(res.json()).resolves.toEqual({
      results: [
        {
          googleBooksId: "PCq3AAAAQBAJ",
          title: "Dom Casmurro",
          authors: ["Machado de Assis"],
          coverUrl: "https://books.google.com/books/content?id=PCq3AAAAQBAJ",
          publishedDate: "1899",
          categories: ["Fiction"],
          pageCount: null,
          rating: 4,
        },
      ],
    });

    vi.unstubAllGlobals();
  });
});

describe("GET /api/books/:googleBooksId", () => {
  it("livro inexistente na Google Books retorna 404", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ error: { code: 404 } }, 404)));

    const res = await app.request("/api/books/id-inexistente", { headers: { cookie } }, env);

    expect(res.status).toBe(404);
    vi.unstubAllGlobals();
  });

  it("cacheia o livro na primeira consulta; entry vem null (marcação ainda não existe)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-501", "O Cortiço"));

    const res = await app.request("/api/books/book-501", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      book: {
        googleBooksId: "book-501",
        title: "O Cortiço",
        authors: ["Autor de Teste"],
        coverUrl: "https://books.google.com/books/content?id=book-501",
        publishedDate: "2010-07-15",
        categories: ["Fiction"],
        pageCount: 320,
        rating: 4.5,
        description: "Sinopse de O Cortiço",
      },
      entry: null,
    });
    vi.unstubAllGlobals();
  });

  it("não consulta a Google Books de novo quando o livro já está cacheado", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-502", "Vidas Secas"));
    await app.request("/api/books/book-502", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    const throwingFetch = vi.fn().mockRejectedValue(new Error("não deveria chamar a Google Books de novo"));
    vi.stubGlobal("fetch", throwingFetch);

    const res = await app.request("/api/books/book-502", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(throwingFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("revalida o cache depois de 24h", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-503", "Grande Sertão: Veredas"));
    await app.request("/api/books/book-503", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    // Simula o cache tendo mais de 24h.
    await createDb(env)
      .update(book)
      .set({ updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(book.googleBooksId, "book-503"));

    stubGoogleBooksFetchOnce({
      ...googleBooksVolume("book-503", "Grande Sertão: Veredas"),
      volumeInfo: { ...googleBooksVolume("book-503", "Grande Sertão: Veredas").volumeInfo, averageRating: 5 },
    });

    const res = await app.request("/api/books/book-503", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1); // revalidou de verdade, não usou o cache velho
    const body = (await res.json()) as { book: { rating: number } };
    expect(body.book.rating).toBe(5);
    vi.unstubAllGlobals();
  });

  it("mantém o cache velho se a Google Books estiver indisponível ao revalidar", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-504", "Memórias Póstumas de Brás Cubas"));
    await app.request("/api/books/book-504", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    await createDb(env)
      .update(book)
      .set({ updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(book.googleBooksId, "book-504"));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ error: { code: 404 } }, 404)));

    const res = await app.request("/api/books/book-504", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { book: { title: string } };
    expect(body.book.title).toBe("Memórias Póstumas de Brás Cubas");
    vi.unstubAllGlobals();
  });
});

import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { getBookById, searchBooks } from "./books";

const BOOK_VOLUME = {
  id: "PCq3AAAAQBAJ",
  volumeInfo: {
    title: "Dom Casmurro",
    authors: ["Machado de Assis"],
    publishedDate: "1899",
    description: "A história de Bentinho e sua desconfiança em relação a Capitu.",
    pageCount: 256,
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

describe("integrations/googlebooks", () => {
  it("busca livros com a API key na query string, sem etapa de OAuth", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ items: [BOOK_VOLUME], totalItems: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks(env, "dom casmurro");

    expect(results).toEqual([BOOK_VOLUME]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(
      `https://www.googleapis.com/books/v1/volumes?q=dom%20casmurro&maxResults=20&key=${env.GOOGLE_BOOKS_API_KEY}`,
    );

    vi.unstubAllGlobals();
  });

  it("busca livros devolve array vazio quando a Google Books não retorna `items`", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ totalItems: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks(env, "livro-inexistente-xyz");

    expect(results).toEqual([]);

    vi.unstubAllGlobals();
  });

  it("getBookById devolve o volume completo", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(BOOK_VOLUME));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getBookById(env, "PCq3AAAAQBAJ");

    expect(result).toEqual(BOOK_VOLUME);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://www.googleapis.com/books/v1/volumes/PCq3AAAAQBAJ?key=${env.GOOGLE_BOOKS_API_KEY}`,
    );

    vi.unstubAllGlobals();
  });

  it("getBookById retorna null quando a Google Books responde 404", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ error: { code: 404 } }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getBookById(env, "id-inexistente");

    expect(result).toBeNull();

    vi.unstubAllGlobals();
  });
});

import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { getAuthorBooks } from "./authors.service";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function volume(id: string, title: string, authors: string[], publishedDate: string) {
  return {
    id,
    volumeInfo: { title, authors, publishedDate },
  };
}

describe("getAuthorBooks", () => {
  it('busca com inauthor:"nome" e devolve os livros ordenados por data decrescente', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        items: [
          volume("id-1", "Duna", ["Frank Herbert"], "1965-08-01"),
          volume("id-2", "Messias de Duna", ["Frank Herbert"], "1969-01-01"),
        ],
        totalItems: 2,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAuthorBooks(env, "Frank Herbert");

    expect(result.name).toBe("Frank Herbert");
    expect(result.books.map((book) => book.title)).toEqual(["Messias de Duna", "Duna"]);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toContain(encodeURIComponent(`inauthor:"Frank Herbert"`));

    vi.unstubAllGlobals();
  });

  it("filtra volumes que a busca textual trouxe mas não creditam o nome exato", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        items: [
          volume("id-1", "Duna", ["Frank Herbert"], "1965-08-01"),
          volume("id-2", "Outro livro qualquer", ["Autor Sem Relação"], "2020-01-01"),
        ],
        totalItems: 2,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAuthorBooks(env, "Frank Herbert");

    expect(result.books.map((book) => book.title)).toEqual(["Duna"]);

    vi.unstubAllGlobals();
  });

  it("compara nome de forma case-insensitive e ignorando espaço sobrando (dado sujo da Google Books)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        items: [volume("id-1", "Duna", ["frank herbert "], "1965-08-01")],
        totalItems: 1,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAuthorBooks(env, "  Frank Herbert  ");

    expect(result.name).toBe("Frank Herbert");
    expect(result.books).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it("nome sem nenhum livro correspondente devolve lista vazia (não lança erro)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ totalItems: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAuthorBooks(env, "Autor Inexistente");

    expect(result).toEqual({ name: "Autor Inexistente", books: [] });

    vi.unstubAllGlobals();
  });
});

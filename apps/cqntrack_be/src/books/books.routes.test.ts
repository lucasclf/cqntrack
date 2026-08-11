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

describe("CRUD de marcação (/api/books/:googleBooksId/entry)", () => {
  it("PUT cria uma marcação nova, com status, nota e review", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-601", "1984"));

    const res = await app.request(
      "/api/books/book-601/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reading", rating: 4.5, review: "Excelente" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      status: "reading",
      rating: 4.5,
      review: "Excelente",
      favoriteSlot: null,
    });
    vi.unstubAllGlobals();
  });

  it("PUT com payload parcial não apaga campos já preenchidos", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-603", "Admirável Mundo Novo"));
    await app.request(
      "/api/books/book-603/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 3.5, status: "reading" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/books/book-603/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ review: "Revi e confirmo" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { rating: number; review: string; status: string };
    expect(body.rating).toBe(3.5);
    expect(body.review).toBe("Revi e confirmo");
    expect(body.status).toBe("reading");
  });

  it("mudar o status gera atividade status_changed; desmarcar (status: null) não gera atividade", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-604", "Fahrenheit 451"));

    await app.request(
      "/api/books/book-604/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "read" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    await app.request(
      "/api/books/book-604/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: null }),
      },
      env,
    );

    const activities = await createDb(env).query.activity.findMany();
    const statusChanged = activities.filter(
      (item) => item.itemId === "book-604" && item.type === "status_changed",
    );
    expect(statusChanged).toHaveLength(1); // só a marcação, não o clear
    expect(statusChanged[0]?.metadata).toEqual({ status: "read" });
  });

  it("PUT com nota gera atividade rated", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-605", "O Apanhador no Campo de Centeio"));

    await app.request(
      "/api/books/book-605/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 4 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const rated = activities.filter((item) => item.itemId === "book-605" && item.type === "rated");
    expect(rated).toHaveLength(1);
    expect(rated[0]?.metadata).toEqual({ rating: 4 });
  });

  it("DELETE remove a marcação", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-606", "Cem Anos de Solidão"));
    await app.request(
      "/api/books/book-606/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 5 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const deleteRes = await app.request(
      "/api/books/book-606/entry",
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(deleteRes.status).toBe(204);

    stubGoogleBooksFetchOnce(googleBooksVolume("book-606", "Cem Anos de Solidão"));
    const detailRes = await app.request("/api/books/book-606", { headers: { cookie } }, env);
    await expect(detailRes.json()).resolves.toMatchObject({ entry: null });
    vi.unstubAllGlobals();
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request(
      "/api/books/book-601/entry",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating: 3 }) },
      env,
    );

    expect(res.status).toBe(401);
  });
});

describe("GET /api/books/entries", () => {
  it("lista só as marcações do usuário logado, filtrando por status", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubGoogleBooksFetchOnce(googleBooksVolume("book-701", "Neuromancer"));
    await app.request(
      "/api/books/book-701/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "read" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubGoogleBooksFetchOnce(googleBooksVolume("book-702", "Duna"));
    await app.request(
      "/api/books/book-702/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reading" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request("/api/books/entries?status=read", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; items: Array<Record<string, unknown>> };
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ book: { googleBooksId: "book-701" } });
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/books/entries", undefined, env);

    expect(res.status).toBe(401);
  });
});

describe("GET/PUT /api/books/favorites", () => {
  it("sem sessão retorna 401 tanto pra GET quanto pra PUT", async () => {
    const getRes = await app.request("/api/books/favorites", undefined, env);
    expect(getRes.status).toBe(401);

    const putRes = await app.request(
      "/api/books/favorites/1",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleBooksId: "book-1" }),
      },
      env,
    );
    expect(putRes.status).toBe(401);
  });

  it("GET começa com os 4 slots vazios", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/books/favorites", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { slots: Array<{ slot: number; entry: unknown }> };
    expect(body.slots).toEqual([
      { slot: 1, entry: null },
      { slot: 2, entry: null },
      { slot: 3, entry: null },
      { slot: 4, entry: null },
    ]);
  });

  it("PUT /favorites/:slot preenche um slot e reflete no GET", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-801", "Parasita"));

    const putRes = await app.request(
      "/api/books/favorites/2",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ googleBooksId: "book-801" }),
      },
      env,
    );
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody).toMatchObject({ favoriteSlot: 2 });
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/books/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as {
      slots: Array<{ slot: number; entry: { book: { googleBooksId: string } } | null }>;
    };
    expect(getBody.slots[1]).toMatchObject({ slot: 2, entry: { book: { googleBooksId: "book-801" } } });
    expect(getBody.slots[0]).toEqual({ slot: 1, entry: null });
  });

  it("trocar um slot já ocupado libera o livro que estava nele", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-802", "Ensaio sobre a Cegueira"));
    await app.request(
      "/api/books/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ googleBooksId: "book-802" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubGoogleBooksFetchOnce(googleBooksVolume("book-803", "A Revolução dos Bichos"));
    await app.request(
      "/api/books/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ googleBooksId: "book-803" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/books/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as {
      slots: Array<{ slot: number; entry: { book: { googleBooksId: string } } | null }>;
    };
    expect(getBody.slots[0]).toMatchObject({ slot: 1, entry: { book: { googleBooksId: "book-803" } } });

    const entryRes = await app.request("/api/books/book-802", { headers: { cookie } }, env);
    const entryBody = (await entryRes.json()) as { entry: { favoriteSlot: number | null } | null };
    expect(entryBody.entry?.favoriteSlot ?? null).toBeNull();
  });

  it("escolher o mesmo livro pra outro slot move-o (não duplica em dois slots)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-804", "O Nome do Vento"));
    await app.request(
      "/api/books/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ googleBooksId: "book-804" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const throwingFetch = vi
      .fn()
      .mockRejectedValue(new Error("já cacheado, não deveria chamar a Google Books de novo"));
    vi.stubGlobal("fetch", throwingFetch);
    await app.request(
      "/api/books/favorites/3",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ googleBooksId: "book-804" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/books/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as { slots: Array<{ slot: number; entry: unknown }> };
    expect(getBody.slots[0]).toEqual({ slot: 1, entry: null });
    expect(getBody.slots[2]?.entry).not.toBeNull();
  });

  it("slot inválido (fora de 1-4) retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request(
      "/api/books/favorites/5",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ googleBooksId: "book-1" }),
      },
      env,
    );

    expect(res.status).toBe(400);
  });

  it("favoritar gera atividade do tipo favorited", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubGoogleBooksFetchOnce(googleBooksVolume("book-805", "A Insustentável Leveza do Ser"));

    await app.request(
      "/api/books/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ googleBooksId: "book-805" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const favorited = activities.filter((item) => item.itemId === "book-805" && item.type === "favorited");
    expect(favorited).toHaveLength(1);
  });
});

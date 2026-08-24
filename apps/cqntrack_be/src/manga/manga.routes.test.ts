import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { createDb } from "../db/client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Shape mínimo de um mangá cru da MangaDex — só os campos que o mapeador
// (manga.service.ts) realmente lê. `id` de relationship author/cover_art é
// arbitrário pro teste, só precisa ser único o bastante pra não colidir.
function mangadexManga(
  id: string,
  title: string,
  options: { status?: string; year?: number | null; authorId?: string; authorName?: string } = {},
) {
  return {
    id,
    attributes: {
      title: { en: title },
      altTitles: [],
      description: { en: `Sinopse de ${title}` },
      status: options.status ?? "ongoing",
      contentRating: "safe",
      year: options.year === undefined ? 2020 : options.year,
      tags: [
        { attributes: { name: { en: "Ação" }, group: "genre" } },
        { attributes: { name: { en: "Formato" }, group: "format" } }, // filtrado fora (não é genre/theme)
      ],
    },
    relationships: [
      {
        id: options.authorId ?? "autor-1",
        type: "author",
        attributes: { name: options.authorName ?? "Autor de Teste" },
      },
      { id: "capa-1", type: "cover_art", attributes: { fileName: "capa.jpg" } },
    ],
  };
}

// A MangaDex não tem etapa de token/key — um fetch mockado por chamada é
// suficiente, mesmo padrão de stubGoogleBooksFetchOnce (livro).
function stubMangadexFetchOnce(...responses: unknown[]): void {
  const fetchMock = vi.fn();
  for (const body of responses) {
    fetchMock.mockResolvedValueOnce(jsonResponse(body));
  }
  vi.stubGlobal("fetch", fetchMock);
}

describe("GET /api/manga/search", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/manga/search?q=death+note", undefined, env);
    expect(res.status).toBe(401);
  });

  it("sem o parâmetro q retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const res = await app.request("/api/manga/search", { headers: { cookie } }, env);
    expect(res.status).toBe(400);
  });

  it("mapeia o resultado pro DTO, com autor{id,name} e tags filtradas a genre/theme", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({ data: [mangadexManga("manga-1", "Death Note")], total: 1 });

    const res = await app.request("/api/manga/search?q=death+note", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    await expect(res.json()).resolves.toEqual({
      results: [
        {
          mangadexId: "manga-1",
          title: "Death Note",
          coverUrl: "https://uploads.mangadex.org/covers/manga-1/capa.jpg.512.jpg",
          authors: [{ id: "autor-1", name: "Autor de Teste" }],
          tags: ["Ação"],
          publicationStatus: "ongoing",
          year: 2020,
        },
      ],
    });
  });
});

describe("GET /api/manga/discover", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/manga/discover", undefined, env);
    expect(res.status).toBe(401);
  });

  it("devolve populares com hasMore calculado a partir do total", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({
      data: [
        mangadexManga("popular-1", "Solo Leveling"),
        mangadexManga("popular-2", "Chainsaw Man"),
      ],
      total: 50,
    });

    const res = await app.request("/api/manga/discover?page=1", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: unknown[]; page: number; hasMore: boolean };
    expect(body.results).toHaveLength(2);
    expect(body.page).toBe(1);
    expect(body.hasMore).toBe(true);
  });
});

describe("GET /api/manga/:mangadexId", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/manga/manga-1", undefined, env);
    expect(res.status).toBe(401);
  });

  it("cacheia o mangá (1 fetch) e devolve detalhe + description, sem marcação (entry null)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({ data: mangadexManga("manga-2", "Death Note") });

    const res = await app.request("/api/manga/manga-2", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    const body = (await res.json()) as { manga: { description: string | null }; entry: unknown };
    expect(body.manga.description).toBe("Sinopse de Death Note");
    expect(body.entry).toBeNull();
  });

  it("mangá inexistente na MangaDex (404) retorna manga_not_found", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "not found" }, 404)));

    const res = await app.request("/api/manga/inexistente", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "manga_not_found" });
  });
});

describe("PUT /api/manga/:mangadexId/entry", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request(
      "/api/manga/manga-3/entry",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("grava status/nota/favorito e gera activity de cada mudança real", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({ data: mangadexManga("manga-3", "Death Note") });

    const res = await app.request(
      "/api/manga/manga-3/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reading", rating: 4.5, favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      rating: number;
      readChapterCount: number;
      favoritedAt: string | null;
    };
    expect(body).toMatchObject({ status: "reading", rating: 4.5, readChapterCount: 0 });
    expect(body.favoritedAt).not.toBeNull();

    const db = createDb(env);
    const activities = await db.query.activity.findMany();
    const types = activities.map((a) => a.type).sort();
    expect(types).toEqual(["favorited", "rated", "status_changed"]);
    expect(activities.every((a) => a.mediaType === "manga")).toBe(true);
  });
});

describe("DELETE /api/manga/:mangadexId/entry", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/manga/manga-4/entry", { method: "DELETE" }, env);
    expect(res.status).toBe(401);
  });

  it("remove a marcação e devolve 204", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({ data: mangadexManga("manga-4", "Death Note") });
    await app.request(
      "/api/manga/manga-4/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reading" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/manga/manga-4/entry",
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(res.status).toBe(204);

    const getRes = await app.request("/api/manga/manga-4", { headers: { cookie } }, env);
    const body = (await getRes.json()) as { entry: unknown };
    expect(body.entry).toBeNull();
  });
});

describe("GET /api/manga/:mangadexId/volumes", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/manga/manga-5/volumes", undefined, env);
    expect(res.status).toBe(401);
  });

  it("parseia volume/capítulo como number (incl. decimal e 'none' -> 0), marca 'read' a partir do já lido", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({
      volumes: {
        "1": {
          volume: "1",
          chapters: {
            "1": { chapter: "1", id: "cap-1" },
            "10.5": { chapter: "10.5", id: "cap-10-5" },
          },
        },
        none: {
          volume: "none",
          chapters: { "0.5": { chapter: "0.5", id: "cap-0-5" } },
        },
      },
    });

    const res = await app.request("/api/manga/manga-5/volumes", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      volumes: Array<{
        volumeNumber: number;
        chapters: Array<{ chapterNumber: number; read: boolean }>;
      }>;
    };
    // Ordenado: volume 0 (sentinela "sem volume") antes do volume 1.
    expect(body.volumes).toEqual([
      {
        volumeNumber: 0,
        chapters: [{ chapterNumber: 0.5, mangadexChapterId: "cap-0-5", read: false }],
      },
      {
        volumeNumber: 1,
        chapters: [
          { chapterNumber: 1, mangadexChapterId: "cap-1", read: false },
          { chapterNumber: 10.5, mangadexChapterId: "cap-10-5", read: false },
        ],
      },
    ]);
  });

  // Bug real encontrado testando manualmente contra a API de verdade: a
  // MangaDex usa "none" não só pro volume, mas também pro CAPÍTULO em si
  // (oneshot/doujinshi sem numeração nenhuma, ex. "JoJo x Death Note
  // (Doujinshi)") — `Number("none")` vira NaN e quebrava a validação Zod
  // de chapterNumber (500). Sentinela -1 (não 0, que é um número de
  // capítulo legítimo — prólogo costuma ser "Capítulo 0").
  it("capítulo 'none' (sem numeração, ex. oneshot) vira o sentinela -1 em vez de quebrar", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({
      volumes: {
        none: {
          volume: "none",
          chapters: { none: { chapter: "none", id: "cap-oneshot" } },
        },
      },
    });

    const res = await app.request("/api/manga/manga-5b/volumes", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      volumes: [
        {
          volumeNumber: 0,
          chapters: [{ chapterNumber: -1, mangadexChapterId: "cap-oneshot", read: false }],
        },
      ],
    });
  });
});

describe("PUT /api/manga/:mangadexId/chapters/:volumeNumber/:chapterNumber", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request(
      "/api/manga/manga-6/chapters/1/1",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("marca capítulo decimal como lido, cria a entry automaticamente (sem status), e volumes/read reflete", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({ data: mangadexManga("manga-6", "Death Note") });

    const res = await app.request(
      "/api/manga/manga-6/chapters/1/10.5",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      },
      env,
    );
    vi.unstubAllGlobals();
    expect(res.status).toBe(204);

    const entryRes = await app.request("/api/manga/manga-6", { headers: { cookie } }, env);
    const entryBody = (await entryRes.json()) as {
      entry: { status: string | null; readChapterCount: number } | null;
    };
    expect(entryBody.entry).toMatchObject({ status: null, readChapterCount: 1 });

    stubMangadexFetchOnce({
      volumes: { "1": { volume: "1", chapters: { "10.5": { chapter: "10.5", id: "cap-10-5" } } } },
    });
    const volumesRes = await app.request(
      "/api/manga/manga-6/volumes",
      { headers: { cookie } },
      env,
    );
    vi.unstubAllGlobals();
    const volumesBody = (await volumesRes.json()) as {
      volumes: Array<{ chapters: Array<{ read: boolean }> }>;
    };
    expect(volumesBody.volumes[0]?.chapters[0]?.read).toBe(true);
  });

  it("desmarcar (read: false) remove a linha, sem exigir que o capítulo exista na MangaDex", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({ data: mangadexManga("manga-6b", "Death Note") });
    await app.request(
      "/api/manga/manga-6b/chapters/1/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/manga/manga-6b/chapters/1/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ read: false }),
      },
      env,
    );
    expect(res.status).toBe(204);

    const entryRes = await app.request("/api/manga/manga-6b", { headers: { cookie } }, env);
    const entryBody = (await entryRes.json()) as { entry: { readChapterCount: number } | null };
    expect(entryBody.entry?.readChapterCount).toBe(0);
  });
});

describe("PUT /api/manga/:mangadexId/volumes/:volumeNumber", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request(
      "/api/manga/manga-7/volumes/1",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("marca todos os capítulos do volume de uma vez e gera 1 activity 'volume_read'", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({ data: mangadexManga("manga-7", "Death Note") });
    await app.request(
      "/api/manga/manga-7/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubMangadexFetchOnce({
      volumes: {
        "1": {
          volume: "1",
          chapters: {
            "1": { chapter: "1", id: "cap-1" },
            "2": { chapter: "2", id: "cap-2" },
          },
        },
      },
    });
    const res = await app.request(
      "/api/manga/manga-7/volumes/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      },
      env,
    );
    vi.unstubAllGlobals();
    expect(res.status).toBe(204);

    const entryRes = await app.request("/api/manga/manga-7", { headers: { cookie } }, env);
    const entryBody = (await entryRes.json()) as { entry: { readChapterCount: number } | null };
    expect(entryBody.entry?.readChapterCount).toBe(2);

    const db = createDb(env);
    const activities = await db.query.activity.findMany();
    const volumeReadActivities = activities.filter((a) => a.type === "volume_read");
    expect(volumeReadActivities).toHaveLength(1);
    expect(volumeReadActivities[0]).toMatchObject({ metadata: { volume: 1, chapterCount: 2 } });
  });

  it("volume inexistente na MangaDex retorna 404 volume_not_found", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({ data: mangadexManga("manga-7b", "Death Note") });
    await app.request(
      "/api/manga/manga-7b/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubMangadexFetchOnce({ volumes: {} });
    const res = await app.request(
      "/api/manga/manga-7b/volumes/99",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "volume_not_found" });
  });
});

describe("PUT /api/manga/:mangadexId/read-all", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/manga/manga-8/read-all", { method: "PUT" }, env);
    expect(res.status).toBe(401);
  });

  it("marca todos os volumes/capítulos de uma vez e gera 1 activity 'manga_completed'", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce({ data: mangadexManga("manga-8", "One Piece") });
    await app.request(
      "/api/manga/manga-8/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubMangadexFetchOnce({
      volumes: {
        "1": {
          volume: "1",
          chapters: {
            "1": { chapter: "1", id: "cap-1" },
            "2": { chapter: "2", id: "cap-2" },
          },
        },
        "2": {
          volume: "2",
          chapters: {
            "3": { chapter: "3", id: "cap-3" },
          },
        },
      },
    });
    const res = await app.request(
      "/api/manga/manga-8/read-all",
      { method: "PUT", headers: { cookie } },
      env,
    );
    vi.unstubAllGlobals();
    expect(res.status).toBe(204);

    const entryRes = await app.request("/api/manga/manga-8", { headers: { cookie } }, env);
    const entryBody = (await entryRes.json()) as { entry: { readChapterCount: number } | null };
    expect(entryBody.entry?.readChapterCount).toBe(3);

    const db = createDb(env);
    const activities = await db.query.activity.findMany();
    const completed = activities.filter((a) => a.type === "manga_completed");
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({ metadata: { chapterCount: 3 } });
  });
});

describe("GET /api/manga/authors/:authorId", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/manga/authors/autor-1", undefined, env);
    expect(res.status).toBe(401);
  });

  it("devolve nome (da própria MangaDex) + mangás encontrados", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMangadexFetchOnce(
      { data: { id: "autor-1", attributes: { name: "Ohba Tsugumi" } } },
      { data: [mangadexManga("manga-8", "Death Note", { authorId: "autor-1" })], total: 1 },
    );

    const res = await app.request("/api/manga/authors/autor-1", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: "autor-1",
      name: "Ohba Tsugumi",
      manga: [{ mangadexId: "manga-8" }],
    });
  });

  it("autor inexistente (404 na MangaDex) retorna author_not_found", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "not found" }, 404)));

    const res = await app.request("/api/manga/authors/inexistente", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "author_not_found" });
  });
});

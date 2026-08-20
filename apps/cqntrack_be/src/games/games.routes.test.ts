import type { PaginatedGameEntriesResponse } from "@cqntrack/shared";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { igdbToken } from "../db/schema";
import { createDb } from "../db/client";
import { resetRateLimiter } from "../integrations/igdb/rate-limiter";
import { resetIgdbTokenMemoryCache } from "../integrations/igdb/token";

const TOKEN_RESPONSE = { access_token: "fake-token", expires_in: 3600 };
const IGDB_GAME = {
  id: 1942,
  name: "The Witcher 3: Wild Hunt",
  slug: "the-witcher-3-wild-hunt",
  cover: { image_id: "coaarl" },
  first_release_date: 1431993600,
  platforms: [{ name: "PC (Microsoft Windows)" }],
  genres: [{ name: "Role-playing (RPG)" }],
  total_rating: 92.76,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/games/search", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/games/search?q=witcher", undefined, env);

    expect(res.status).toBe(401);
  });

  it("sem o parâmetro q retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/games/search", { headers: { cookie } }, env);

    expect(res.status).toBe(400);
  });

  it("com sessão e query válida retorna os jogos mapeados para o DTO", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE))
        .mockResolvedValueOnce(jsonResponse([IGDB_GAME])),
    );

    const res = await app.request("/api/games/search?q=witcher", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      results: [
        {
          igdbId: 1942,
          name: "The Witcher 3: Wild Hunt",
          coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/coaarl.jpg",
          firstReleaseDate: "2015-05-19",
          platforms: ["PC (Microsoft Windows)"],
          genres: ["Role-playing (RPG)"],
          rating: 92.76,
        },
      ],
    });

    vi.unstubAllGlobals();
  });
});

describe("GET /api/games/discover", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/games/discover", undefined, env);

    expect(res.status).toBe(401);
  });

  it("devolve os aclamados da IGDB mapeados pro DTO", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE))
        .mockResolvedValueOnce(jsonResponse([IGDB_GAME])),
    );

    const res = await app.request("/api/games/discover", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      results: [
        {
          igdbId: 1942,
          name: "The Witcher 3: Wild Hunt",
          coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/coaarl.jpg",
          firstReleaseDate: "2015-05-19",
          platforms: ["PC (Microsoft Windows)"],
          genres: ["Role-playing (RPG)"],
          rating: 92.76,
        },
      ],
      page: 1,
      hasMore: false,
    });

    vi.unstubAllGlobals();
  });
});

function igdbGame(id: number, name: string) {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    cover: { image_id: `cover-${id}` },
    first_release_date: 1431993600,
    summary: `Resumo do jogo ${id}`,
    platforms: [{ name: "PC (Microsoft Windows)" }],
    genres: [{ name: "Adventure" }],
    total_rating: 88,
  };
}

function stubIgdbFetchOnce(...gameResponses: unknown[][]): void {
  const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE));
  for (const games of gameResponses) {
    fetchMock.mockResolvedValueOnce(jsonResponse(games));
  }
  vi.stubGlobal("fetch", fetchMock);
}

describe("GET /api/games/:igdbId", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("id inválido retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/games/nao-e-um-id", { headers: { cookie } }, env);

    expect(res.status).toBe(400);
  });

  it("jogo inexistente na IGDB retorna 404", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubIgdbFetchOnce([]);

    const res = await app.request("/api/games/999999", { headers: { cookie } }, env);

    expect(res.status).toBe(404);
    vi.unstubAllGlobals();
  });

  it("cacheia o jogo na primeira consulta; entry vem null quando ainda não marcado", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubIgdbFetchOnce([igdbGame(501, "Hollow Knight")]);

    const res = await app.request("/api/games/501", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      game: {
        igdbId: 501,
        name: "Hollow Knight",
        coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/cover-501.jpg",
        firstReleaseDate: "2015-05-19",
        platforms: ["PC (Microsoft Windows)"],
        genres: ["Adventure"],
        rating: 88,
        summary: "Resumo do jogo 501",
      },
      entry: null,
    });
    vi.unstubAllGlobals();
  });

  it("não consulta a IGDB de novo quando o jogo já está cacheado", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubIgdbFetchOnce([igdbGame(502, "Celeste")]);
    await app.request("/api/games/502", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    const throwingFetch = vi.fn().mockRejectedValue(new Error("não deveria chamar a IGDB de novo"));
    vi.stubGlobal("fetch", throwingFetch);

    const res = await app.request("/api/games/502", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(throwingFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("CRUD de marcação (/api/games/:igdbId/entry)", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("PUT cria uma marcação nova", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubIgdbFetchOnce([igdbGame(601, "Hades")]);

    const res = await app.request(
      "/api/games/601/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing", platforms: ["PC"] }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      status: "playing",
      platforms: ["PC"],
      favoritedAt: null,
      rating: null,
    });
    vi.unstubAllGlobals();
  });

  it("PUT com payload parcial não apaga campos já preenchidos", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubIgdbFetchOnce([igdbGame(602, "Outer Wilds")]);
    await app.request(
      "/api/games/602/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing", platforms: ["PC"] }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/games/602/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 4.5 }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "playing", platforms: ["PC"], rating: 4.5 });
  });

  it("PUT com status: null desmarca o status sem apagar os outros campos, e não gera atividade", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubIgdbFetchOnce([igdbGame(605, "Return of the Obra Dinn")]);
    await app.request(
      "/api/games/605/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing", rating: 5 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/games/605/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: null }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: null, rating: 5 });

    const activities = await createDb(env).query.activity.findMany();
    const statusChanged = activities.filter(
      (item) => item.itemId === "605" && item.type === "status_changed",
    );
    expect(statusChanged).toHaveLength(1); // só o "playing" inicial, não o clear
  });

  it("DELETE remove a marcação", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubIgdbFetchOnce([igdbGame(603, "Return of the Obra Dinn")]);
    await app.request(
      "/api/games/603/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const deleteRes = await app.request(
      "/api/games/603/entry",
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(deleteRes.status).toBe(204);

    const detailRes = await app.request("/api/games/603", { headers: { cookie } }, env);
    await expect(detailRes.json()).resolves.toMatchObject({ entry: null });
  });
});

describe("GET /api/games/favorites", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/games/favorites", undefined, env);
    expect(res.status).toBe(401);
  });

  it("começa vazio", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/games/favorites", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items: [] });
  });

  it("favoritar via PUT .../entry reflete no GET, mais recente primeiro, sem limite de quantidade", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    // Um único stub: o token IGDB só é buscado uma vez e fica em cache — a
    // segunda chamada de stubIgdbFetchOnce dentro do mesmo teste consumiria o
    // token mockado como se fosse a resposta do jogo (mesma pegadinha já
    // evitada nos outros testes deste arquivo que favoritam 2 itens).
    stubIgdbFetchOnce([igdbGame(620, "Disco Elysium")], [igdbGame(622, "Celeste")]);

    const putRes = await app.request(
      "/api/games/620/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    expect(putRes.status).toBe(200);
    const putBody = (await putRes.json()) as { favoritedAt: string | null };
    expect(putBody.favoritedAt).not.toBeNull();

    await app.request(
      "/api/games/622/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/games/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as { items: Array<{ game: { igdbId: number } }> };
    expect(getBody.items.map((item) => item.game.igdbId)).toEqual([622, 620]);
  });

  it("desfavoritar tira da lista", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubIgdbFetchOnce([igdbGame(623, "Outer Wilds")]);

    await app.request(
      "/api/games/623/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    await app.request(
      "/api/games/623/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: false }),
      },
      env,
    );

    const getRes = await app.request("/api/games/favorites", { headers: { cookie } }, env);
    await expect(getRes.json()).resolves.toEqual({ items: [] });

    const entryRes = await app.request("/api/games/623", { headers: { cookie } }, env);
    const entryBody = (await entryRes.json()) as { entry: { favoritedAt: string | null } | null };
    expect(entryBody.entry?.favoritedAt ?? null).toBeNull();
  });
});

describe("GET /api/games/entries", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("lista só as marcações do usuário logado, filtrando por status", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubIgdbFetchOnce([igdbGame(701, "Stardew Valley")]);
    await app.request(
      "/api/games/701/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubIgdbFetchOnce([igdbGame(702, "Terraria")]);
    await app.request(
      "/api/games/702/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/games/entries?status=completed",
      { headers: { cookie } },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedGameEntriesResponse;
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ status: "completed", game: { igdbId: 701 } });
  });

  it("filtra por plataforma dentro da lista de plataformas da entry", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubIgdbFetchOnce([igdbGame(703, "Hollow Knight")]);
    await app.request(
      "/api/games/703/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: ["PC", "Switch"] }),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubIgdbFetchOnce([igdbGame(704, "Celeste")]);
    await app.request(
      "/api/games/704/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: ["PS5"] }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/games/entries?platform=Switch",
      { headers: { cookie } },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedGameEntriesResponse;
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ platforms: ["PC", "Switch"], game: { igdbId: 703 } });
  });

  it("excludeNotStarted exclui quem está sem status ou 'not_started', mantendo os demais", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    // Token IGDB fica em cache (memória + D1) entre chamadas — cada
    // stubIgdbFetchOnce assume 2 fetches (token + jogo), então zera os dois
    // caches antes de cada entry pra sempre bater com o que foi mockado
    // (senão a 2ª/3ª chamada real usa só 1 fetch, e o mock de token vaza
    // pra resposta de jogo).
    async function resetIgdbToken() {
      resetIgdbTokenMemoryCache();
      await createDb(env).delete(igdbToken);
    }

    stubIgdbFetchOnce([igdbGame(705, "Sem status")]);
    await app.request(
      "/api/games/705/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();
    await resetIgdbToken();

    stubIgdbFetchOnce([igdbGame(706, "Quero jogar")]);
    await app.request(
      "/api/games/706/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "not_started" }),
      },
      env,
    );
    vi.unstubAllGlobals();
    await resetIgdbToken();

    stubIgdbFetchOnce([igdbGame(707, "Jogando")]);
    await app.request(
      "/api/games/707/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/games/entries?excludeNotStarted=true",
      { headers: { cookie } },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedGameEntriesResponse;
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ status: "playing", game: { igdbId: 707 } });
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/games/entries", undefined, env);

    expect(res.status).toBe(401);
  });
});

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
    expect(body).toMatchObject({ status: "playing", platforms: ["PC"], favoriteSlot: null, rating: null });
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
      { method: "PUT", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ status: null }) },
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

describe("GET/PUT /api/games/favorites", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("sem sessão retorna 401 tanto pra GET quanto pra PUT", async () => {
    const getRes = await app.request("/api/games/favorites", undefined, env);
    expect(getRes.status).toBe(401);

    const putRes = await app.request(
      "/api/games/favorites/1",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ igdbId: 1 }) },
      env,
    );
    expect(putRes.status).toBe(401);
  });

  it("GET começa com os 4 slots vazios", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/games/favorites", { headers: { cookie } }, env);

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
    stubIgdbFetchOnce([igdbGame(620, "Disco Elysium")]);

    const putRes = await app.request(
      "/api/games/favorites/2",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ igdbId: 620 }),
      },
      env,
    );
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody).toMatchObject({ favoriteSlot: 2 });
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/games/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as { slots: Array<{ slot: number; entry: { game: { igdbId: number } } | null }> };
    expect(getBody.slots[1]).toMatchObject({ slot: 2, entry: { game: { igdbId: 620 } } });
    expect(getBody.slots[0]).toEqual({ slot: 1, entry: null });
  });

  it("trocar um slot já ocupado libera o jogo que estava nele", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubIgdbFetchOnce([igdbGame(621, "Hades")], [igdbGame(622, "Celeste")]);

    await app.request(
      "/api/games/favorites/1",
      { method: "PUT", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ igdbId: 621 }) },
      env,
    );
    await app.request(
      "/api/games/favorites/1",
      { method: "PUT", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ igdbId: 622 }) },
      env,
    );
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/games/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as { slots: Array<{ slot: number; entry: { game: { igdbId: number } } | null }> };
    expect(getBody.slots[0]).toMatchObject({ slot: 1, entry: { game: { igdbId: 622 } } });

    const entryRes = await app.request("/api/games/621", { headers: { cookie } }, env);
    const entryBody = (await entryRes.json()) as { entry: { favoriteSlot: number | null } | null };
    expect(entryBody.entry?.favoriteSlot ?? null).toBeNull();
  });

  it("escolher o mesmo jogo pra outro slot move-o (não duplica em dois slots)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubIgdbFetchOnce([igdbGame(623, "Outer Wilds")]);

    await app.request(
      "/api/games/favorites/1",
      { method: "PUT", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ igdbId: 623 }) },
      env,
    );
    await app.request(
      "/api/games/favorites/3",
      { method: "PUT", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ igdbId: 623 }) },
      env,
    );
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/games/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as { slots: Array<{ slot: number; entry: unknown }> };
    expect(getBody.slots[0]).toEqual({ slot: 1, entry: null });
    expect(getBody.slots[2]?.entry).not.toBeNull();
  });

  it("slot inválido (fora de 1-4) retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request(
      "/api/games/favorites/5",
      { method: "PUT", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ igdbId: 1 }) },
      env,
    );

    expect(res.status).toBe(400);
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

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/games/entries", undefined, env);

    expect(res.status).toBe(401);
  });
});

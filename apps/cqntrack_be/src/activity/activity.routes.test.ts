import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { createDb } from "../db/client";
import { igdbToken } from "../db/schema";
import { resetRateLimiter } from "../integrations/igdb/rate-limiter";
import { resetIgdbTokenMemoryCache } from "../integrations/igdb/token";

const TOKEN_RESPONSE = { access_token: "fake-token", expires_in: 3600 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("/api/activity", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/activity", undefined, env);

    expect(res.status).toBe(401);
  });

  it("lista as atividades do usuário, mais recente primeiro, com o campo certo por tipo", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    // Um único fetch mockado cobre a sequência inteira do teste: o token só é
    // buscado uma vez (fica em cache em memória) e cada jogo novo consome um
    // valor da fila, na ordem em que é efetivamente requisitado à IGDB.
    stubIgdbFetchOnce([igdbGame(901, "Hades")], [igdbGame(902, "Celeste")]);

    // status_changed no jogo 901
    await app.request(
      "/api/games/901/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing" }),
      },
      env,
    );
    await sleep(5);

    // rated no jogo 901 (mesmo jogo, já cacheado — sem nova chamada à IGDB)
    await app.request(
      "/api/games/901/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 4.5 }),
      },
      env,
    );
    await sleep(5);

    // added_to_list no jogo 902
    const createListRes = await app.request(
      "/api/lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Favoritos" }),
      },
      env,
    );
    const { id: listId } = (await createListRes.json()) as { id: string };

    await app.request(
      `/api/lists/${listId}/items/902`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request("/api/activity", { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
    };

    expect(body.items).toHaveLength(3);
    expect(body.nextCursor).toBeNull();

    // mais recente primeiro
    expect(body.items[0]).toMatchObject({
      type: "added_to_list",
      mediaType: "games",
      itemId: "902",
      itemHref: "/jogos/902",
      metadata: { listId, listName: "Favoritos" },
    });
    expect(body.items[1]).toMatchObject({ type: "rated", metadata: { rating: 4.5 } });
    expect(body.items[2]).toMatchObject({
      type: "status_changed",
      metadata: { status: "playing" },
    });

    for (const item of body.items) {
      expect(item.itemTitle).toEqual(expect.any(String));
    }
  });

  it("pagina por cursor sem duplicar nem perder itens", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubIgdbFetchOnce(
      [igdbGame(801, "Jogo A")],
      [igdbGame(802, "Jogo B")],
      [igdbGame(803, "Jogo C")],
    );

    await app.request(
      "/api/games/801/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing" }),
      },
      env,
    );
    await sleep(5);

    await app.request(
      "/api/games/802/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing" }),
      },
      env,
    );
    await sleep(5);

    await app.request(
      "/api/games/803/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const firstPageRes = await app.request("/api/activity?limit=2", { headers: { cookie } }, env);
    const firstPage = (await firstPageRes.json()) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPageRes = await app.request(
      `/api/activity?limit=2&before=${encodeURIComponent(firstPage.nextCursor!)}`,
      { headers: { cookie } },
      env,
    );
    const secondPage = (await secondPageRes.json()) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();

    const allIds = [...firstPage.items, ...secondPage.items].map((item) => item.id);
    expect(new Set(allIds).size).toBe(3);
  });

  it("filtra por mediaType (aba 'Atividades' da home)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubIgdbFetchOnce([igdbGame(911, "Hollow Knight")]);
    await app.request(
      "/api/games/911/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "playing" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const tmdbMovieDetail = {
      id: 27205,
      title: "Inception",
      poster_path: "/poster.jpg",
      release_date: "2010-07-15",
      overview: "Resumo",
      genres: [],
      runtime: 148,
      vote_average: 8.4,
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(tmdbMovieDetail))
        .mockResolvedValueOnce(jsonResponse({ cast: [], crew: [] })),
    );
    await app.request(
      "/api/movies/27205/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const gamesRes = await app.request(
      "/api/activity?mediaType=games",
      { headers: { cookie } },
      env,
    );
    const gamesBody = (await gamesRes.json()) as { items: Array<{ mediaType: string }> };
    expect(gamesBody.items).toHaveLength(1);
    expect(gamesBody.items[0]?.mediaType).toBe("games");

    const moviesRes = await app.request(
      "/api/activity?mediaType=movies",
      { headers: { cookie } },
      env,
    );
    const moviesBody = (await moviesRes.json()) as { items: Array<{ mediaType: string }> };
    expect(moviesBody.items).toHaveLength(1);
    expect(moviesBody.items[0]?.mediaType).toBe("movies");

    const allRes = await app.request("/api/activity", { headers: { cookie } }, env);
    const allBody = (await allRes.json()) as { items: unknown[] };
    expect(allBody.items).toHaveLength(2);
  });
});

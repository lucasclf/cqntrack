import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { createDb } from "../db/client";
import { movie } from "../db/schema";

const TMDB_SEARCH_RESULT = {
  id: 27205,
  title: "Inception",
  poster_path: "/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg",
  release_date: "2010-07-15",
  genre_ids: [28, 878],
  vote_average: 8.4,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tmdbMovieDetail(id: number, title: string) {
  return {
    id,
    title,
    poster_path: `/poster-${id}.jpg`,
    release_date: "2010-07-15",
    overview: `Resumo do filme ${id}`,
    genres: [{ id: 28, name: "Action" }],
    runtime: 148,
    vote_average: 8.4,
  };
}

// A TMDB não tem etapa de token (diferente da IGDB) — um fetch mockado por
// chamada é suficiente.
function stubTmdbFetchOnce(...responses: unknown[]): void {
  const fetchMock = vi.fn();
  for (const body of responses) {
    fetchMock.mockResolvedValueOnce(jsonResponse(body));
  }
  vi.stubGlobal("fetch", fetchMock);
}

describe("GET /api/movies/search", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/movies/search?q=inception", undefined, env);

    expect(res.status).toBe(401);
  });

  it("sem o parâmetro q retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/movies/search", { headers: { cookie } }, env);

    expect(res.status).toBe(400);
  });

  it("com sessão e query válida retorna os filmes mapeados para o DTO (um único request à TMDB)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce({ results: [TMDB_SEARCH_RESULT] });

    const res = await app.request("/api/movies/search?q=inception", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(res.json()).resolves.toEqual({
      results: [
        {
          tmdbId: 27205,
          name: "Inception",
          posterUrl: "https://image.tmdb.org/t/p/w342/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg",
          releaseDate: "2010-07-15",
          genres: ["Action", "Science Fiction"],
          runtime: null,
          rating: 8.4,
        },
      ],
    });

    vi.unstubAllGlobals();
  });
});

describe("GET /api/movies/:tmdbId", () => {
  it("id inválido retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/movies/nao-e-um-id", { headers: { cookie } }, env);

    expect(res.status).toBe(400);
  });

  it("filme inexistente na TMDB retorna 404", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404)),
    );

    const res = await app.request("/api/movies/999999999", { headers: { cookie } }, env);

    expect(res.status).toBe(404);
    vi.unstubAllGlobals();
  });

  it("cacheia o filme na primeira consulta; entry vem null (marcação ainda não existe)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(501, "The Matrix"));

    const res = await app.request("/api/movies/501", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      movie: {
        tmdbId: 501,
        name: "The Matrix",
        posterUrl: "https://image.tmdb.org/t/p/w342/poster-501.jpg",
        releaseDate: "2010-07-15",
        genres: ["Action"],
        runtime: 148,
        rating: 8.4,
        overview: "Resumo do filme 501",
      },
      entry: null,
    });
    vi.unstubAllGlobals();
  });

  it("não consulta a TMDB de novo quando o filme já está cacheado", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(502, "Interstellar"));
    await app.request("/api/movies/502", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    const throwingFetch = vi.fn().mockRejectedValue(new Error("não deveria chamar a TMDB de novo"));
    vi.stubGlobal("fetch", throwingFetch);

    const res = await app.request("/api/movies/502", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(throwingFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("revalida o cache depois de 24h", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(503, "Dunkirk"));
    await app.request("/api/movies/503", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    // Simula o cache tendo mais de 24h.
    await createDb(env)
      .update(movie)
      .set({ updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(movie.tmdbId, 503));

    stubTmdbFetchOnce({ ...tmdbMovieDetail(503, "Dunkirk"), vote_average: 9.1 });

    const res = await app.request("/api/movies/503", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1); // revalidou de verdade, não usou o cache velho
    const body = (await res.json()) as { movie: { rating: number } };
    expect(body.movie.rating).toBe(9.1);
    vi.unstubAllGlobals();
  });

  it("mantém o cache velho se a TMDB estiver indisponível ao revalidar", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(504, "Tenet"));
    await app.request("/api/movies/504", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    await createDb(env)
      .update(movie)
      .set({ updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(movie.tmdbId, 504));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404)),
    );

    const res = await app.request("/api/movies/504", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { movie: { name: string } };
    expect(body.movie.name).toBe("Tenet");
    vi.unstubAllGlobals();
  });
});

describe("CRUD de marcação (/api/movies/:tmdbId/entry)", () => {
  it("PUT cria uma marcação nova, com nota e review, sem marcar assistido", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(601, "Oppenheimer"));

    const res = await app.request(
      "/api/movies/601/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 4.5, review: "Excelente" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      rating: 4.5,
      review: "Excelente",
      watchedAt: null,
      favoriteSlot: null,
    });
    vi.unstubAllGlobals();
  });

  it("PUT com watched: true marca como assistido; watched: false desmarca", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(602, "Barbie"));

    const markRes = await app.request(
      "/api/movies/602/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );
    expect(markRes.status).toBe(200);
    const markBody = (await markRes.json()) as { watchedAt: string | null };
    expect(markBody.watchedAt).not.toBeNull();
    vi.unstubAllGlobals();

    const unmarkRes = await app.request(
      "/api/movies/602/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: false }),
      },
      env,
    );
    expect(unmarkRes.status).toBe(200);
    const unmarkBody = (await unmarkRes.json()) as { watchedAt: string | null };
    expect(unmarkBody.watchedAt).toBeNull();
  });

  it("PUT com payload parcial não apaga campos já preenchidos", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(603, "Poor Things"));
    await app.request(
      "/api/movies/603/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 3.5, watched: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/movies/603/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ review: "Revi e confirmo" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { rating: number; review: string; watchedAt: string | null };
    expect(body.rating).toBe(3.5);
    expect(body.review).toBe("Revi e confirmo");
    expect(body.watchedAt).not.toBeNull();
  });

  it("marcar como assistido gera atividade watched; desmarcar não gera atividade extra", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(604, "Killers of the Flower Moon"));

    await app.request(
      "/api/movies/604/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    await app.request(
      "/api/movies/604/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: false }),
      },
      env,
    );

    const activities = await createDb(env).query.activity.findMany();
    const watched = activities.filter((item) => item.itemId === "604" && item.type === "watched");
    expect(watched).toHaveLength(1); // só a marcação, não o clear
  });

  it("PUT com nota gera atividade rated", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(605, "Anatomy of a Fall"));

    await app.request(
      "/api/movies/605/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 4 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const rated = activities.filter((item) => item.itemId === "605" && item.type === "rated");
    expect(rated).toHaveLength(1);
    expect(rated[0]?.metadata).toEqual({ rating: 4 });
  });

  it("DELETE remove a marcação", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(606, "The Zone of Interest"));
    await app.request(
      "/api/movies/606/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 5 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const deleteRes = await app.request(
      "/api/movies/606/entry",
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(deleteRes.status).toBe(204);

    stubTmdbFetchOnce(tmdbMovieDetail(606, "The Zone of Interest"));
    const detailRes = await app.request("/api/movies/606", { headers: { cookie } }, env);
    await expect(detailRes.json()).resolves.toMatchObject({ entry: null });
    vi.unstubAllGlobals();
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request(
      "/api/movies/601/entry",
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating: 3 }) },
      env,
    );

    expect(res.status).toBe(401);
  });
});

describe("GET /api/movies/entries", () => {
  it("lista só as marcações do usuário logado, filtrando por assistido", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubTmdbFetchOnce(tmdbMovieDetail(701, "Past Lives"));
    await app.request(
      "/api/movies/701/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubTmdbFetchOnce(tmdbMovieDetail(702, "Priscilla"));
    await app.request(
      "/api/movies/702/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 3 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request("/api/movies/entries?watched=true", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; items: Array<Record<string, unknown>> };
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ movie: { tmdbId: 701 } });
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/movies/entries", undefined, env);

    expect(res.status).toBe(401);
  });
});

describe("GET/PUT /api/movies/favorites", () => {
  it("sem sessão retorna 401 tanto pra GET quanto pra PUT", async () => {
    const getRes = await app.request("/api/movies/favorites", undefined, env);
    expect(getRes.status).toBe(401);

    const putRes = await app.request(
      "/api/movies/favorites/1",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 1 }),
      },
      env,
    );
    expect(putRes.status).toBe(401);
  });

  it("GET começa com os 4 slots vazios", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/movies/favorites", { headers: { cookie } }, env);

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
    stubTmdbFetchOnce(tmdbMovieDetail(801, "Parasite"));

    const putRes = await app.request(
      "/api/movies/favorites/2",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 801 }),
      },
      env,
    );
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody).toMatchObject({ favoriteSlot: 2 });
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/movies/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as {
      slots: Array<{ slot: number; entry: { movie: { tmdbId: number } } | null }>;
    };
    expect(getBody.slots[1]).toMatchObject({ slot: 2, entry: { movie: { tmdbId: 801 } } });
    expect(getBody.slots[0]).toEqual({ slot: 1, entry: null });
  });

  it("trocar um slot já ocupado libera o filme que estava nele", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(802, "Everything Everywhere All at Once"));
    await app.request(
      "/api/movies/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 802 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubTmdbFetchOnce(tmdbMovieDetail(803, "The Whale"));
    await app.request(
      "/api/movies/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 803 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/movies/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as {
      slots: Array<{ slot: number; entry: { movie: { tmdbId: number } } | null }>;
    };
    expect(getBody.slots[0]).toMatchObject({ slot: 1, entry: { movie: { tmdbId: 803 } } });

    const entryRes = await app.request("/api/movies/802", { headers: { cookie } }, env);
    const entryBody = (await entryRes.json()) as { entry: { favoriteSlot: number | null } | null };
    expect(entryBody.entry?.favoriteSlot ?? null).toBeNull();
  });

  it("escolher o mesmo filme pra outro slot move-o (não duplica em dois slots)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(804, "Nomadland"));
    await app.request(
      "/api/movies/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 804 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const throwingFetch = vi
      .fn()
      .mockRejectedValue(new Error("já cacheado, não deveria chamar a TMDB de novo"));
    vi.stubGlobal("fetch", throwingFetch);
    await app.request(
      "/api/movies/favorites/3",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 804 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/movies/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as { slots: Array<{ slot: number; entry: unknown }> };
    expect(getBody.slots[0]).toEqual({ slot: 1, entry: null });
    expect(getBody.slots[2]?.entry).not.toBeNull();
  });

  it("slot inválido (fora de 1-4) retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request(
      "/api/movies/favorites/5",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 1 }),
      },
      env,
    );

    expect(res.status).toBe(400);
  });

  it("favoritar gera atividade do tipo favorited", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(805, "CODA"));

    await app.request(
      "/api/movies/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 805 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const favorited = activities.filter(
      (item) => item.itemId === "805" && item.type === "favorited",
    );
    expect(favorited).toHaveLength(1);
  });
});

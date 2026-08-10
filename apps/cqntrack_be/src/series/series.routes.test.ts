import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { createDb } from "../db/client";

const TMDB_SEARCH_RESULT = {
  id: 1396,
  name: "Breaking Bad",
  poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  first_air_date: "2008-01-20",
  genre_ids: [18, 80],
  vote_average: 8.9,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tmdbSeriesDetail(id: number, name: string) {
  return {
    id,
    name,
    poster_path: `/poster-${id}.jpg`,
    first_air_date: "2008-01-20",
    overview: `Resumo da série ${id}`,
    genres: [{ id: 18, name: "Drama" }],
    number_of_seasons: 5,
    number_of_episodes: 62,
    vote_average: 8.9,
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

describe("GET /api/series/search", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/series/search?q=breaking+bad", undefined, env);

    expect(res.status).toBe(401);
  });

  it("sem o parâmetro q retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/series/search", { headers: { cookie } }, env);

    expect(res.status).toBe(400);
  });

  it("com sessão e query válida retorna as séries mapeadas para o DTO (um único request à TMDB)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce({ results: [TMDB_SEARCH_RESULT] });

    const res = await app.request("/api/series/search?q=breaking+bad", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(res.json()).resolves.toEqual({
      results: [
        {
          tmdbId: 1396,
          name: "Breaking Bad",
          posterUrl: "https://image.tmdb.org/t/p/w342/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
          firstAirDate: "2008-01-20",
          genres: ["Drama", "Crime"],
          numberOfSeasons: null,
          numberOfEpisodes: null,
          rating: 8.9,
        },
      ],
    });

    vi.unstubAllGlobals();
  });
});

describe("GET /api/series/:tmdbId", () => {
  it("id inválido retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/series/nao-e-um-id", { headers: { cookie } }, env);

    expect(res.status).toBe(400);
  });

  it("série inexistente na TMDB retorna 404", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404)));

    const res = await app.request("/api/series/999999999", { headers: { cookie } }, env);

    expect(res.status).toBe(404);
    vi.unstubAllGlobals();
  });

  it("cacheia a série na primeira consulta; entry vem null quando ainda não marcada", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(501, "The Wire"));

    const res = await app.request("/api/series/501", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      series: {
        tmdbId: 501,
        name: "The Wire",
        posterUrl: "https://image.tmdb.org/t/p/w342/poster-501.jpg",
        firstAirDate: "2008-01-20",
        genres: ["Drama"],
        numberOfSeasons: 5,
        numberOfEpisodes: 62,
        rating: 8.9,
        overview: "Resumo da série 501",
      },
      entry: null,
    });
    vi.unstubAllGlobals();
  });

  it("não consulta a TMDB de novo quando a série já está cacheada", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(502, "Fargo"));
    await app.request("/api/series/502", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    const throwingFetch = vi.fn().mockRejectedValue(new Error("não deveria chamar a TMDB de novo"));
    vi.stubGlobal("fetch", throwingFetch);

    const res = await app.request("/api/series/502", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(throwingFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("CRUD de marcação (/api/series/:tmdbId/entry)", () => {
  it("PUT cria uma marcação nova, com status/nota/progresso/review", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(601, "Better Call Saul"));

    const res = await app.request(
      "/api/series/601/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "watching", rating: 4.5, currentSeason: 2, currentEpisode: 5 }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      status: "watching",
      rating: 4.5,
      currentSeason: 2,
      currentEpisode: 5,
      favoriteSlot: null,
    });
    vi.unstubAllGlobals();
  });

  it("PUT com payload parcial não apaga campos já preenchidos", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(602, "Ozark"));
    await app.request(
      "/api/series/602/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "watching", currentSeason: 1, currentEpisode: 3 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/series/602/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ currentEpisode: 4 }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "watching", currentSeason: 1, currentEpisode: 4 });
  });

  it("PUT com progresso gera atividade progress_updated (tipo que jogos não tem)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(604, "The Sopranos"));

    await app.request(
      "/api/series/604/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ currentSeason: 3, currentEpisode: 7 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const progressUpdated = activities.filter(
      (item) => item.itemId === "604" && item.type === "progress_updated",
    );
    expect(progressUpdated).toHaveLength(1);
    expect(progressUpdated[0]?.metadata).toEqual({ season: 3, episode: 7 });
  });

  it("PUT com status: null desmarca o status sem apagar os outros campos, e não gera atividade extra", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(605, "Mindhunter"));
    await app.request(
      "/api/series/605/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "watching", rating: 5 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/series/605/entry",
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
    expect(statusChanged).toHaveLength(1); // só o "watching" inicial, não o clear
  });

  it("DELETE remove a marcação", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(603, "Chernobyl"));
    await app.request(
      "/api/series/603/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const deleteRes = await app.request(
      "/api/series/603/entry",
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(deleteRes.status).toBe(204);

    stubTmdbFetchOnce(tmdbSeriesDetail(603, "Chernobyl"));
    const detailRes = await app.request("/api/series/603", { headers: { cookie } }, env);
    await expect(detailRes.json()).resolves.toMatchObject({ entry: null });
    vi.unstubAllGlobals();
  });
});

describe("GET /api/series/entries", () => {
  it("lista só as marcações do usuário logado, filtrando por status", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubTmdbFetchOnce(tmdbSeriesDetail(701, "Succession"));
    await app.request(
      "/api/series/701/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubTmdbFetchOnce(tmdbSeriesDetail(702, "The Bear"));
    await app.request(
      "/api/series/702/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "watching" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request("/api/series/entries?status=completed", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; items: Array<Record<string, unknown>> };
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ status: "completed", series: { tmdbId: 701 } });
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/series/entries", undefined, env);

    expect(res.status).toBe(401);
  });
});

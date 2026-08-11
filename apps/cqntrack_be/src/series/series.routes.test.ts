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
    seasons: [
      {
        season_number: 1,
        name: "Temporada 1",
        episode_count: 3,
        air_date: "2008-01-20",
        poster_path: `/poster-${id}-s1.jpg`,
      },
    ],
  };
}

function tmdbSeasonDetail(seasonNumber: number, episodeCount: number) {
  return {
    season_number: seasonNumber,
    episodes: Array.from({ length: episodeCount }, (_, index) => ({
      episode_number: index + 1,
      name: `Episódio ${index + 1}`,
      air_date: "2008-01-20",
      still_path: `/still-s${seasonNumber}e${index + 1}.jpg`,
    })),
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

    const res = await app.request(
      "/api/series/search?q=breaking+bad",
      { headers: { cookie } },
      env,
    );

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
          seasons: null,
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404)),
    );

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
        seasons: [
          {
            seasonNumber: 1,
            name: "Temporada 1",
            episodeCount: 3,
            airDate: "2008-01-20",
            posterUrl: "https://image.tmdb.org/t/p/w185/poster-501-s1.jpg",
          },
        ],
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
  it("PUT cria uma marcação nova, com nota e review", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(601, "Better Call Saul"));

    const res = await app.request(
      "/api/series/601/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 4.5, review: "Ótima série" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      rating: 4.5,
      review: "Ótima série",
      watchedEpisodeCount: 0,
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
        body: JSON.stringify({ rating: 3.5 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/series/602/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ review: "Melhorou depois da metade" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ rating: 3.5, review: "Melhorou depois da metade" });
  });

  it("PUT com nota gera atividade rated", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(604, "The Sopranos"));

    await app.request(
      "/api/series/604/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 4 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const rated = activities.filter((item) => item.itemId === "604" && item.type === "rated");
    expect(rated).toHaveLength(1);
    expect(rated[0]?.metadata).toEqual({ rating: 4 });
  });

  it("DELETE remove a marcação", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(603, "Chernobyl"));
    await app.request(
      "/api/series/603/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 5 }),
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
  it("lista só as marcações do usuário logado", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubTmdbFetchOnce(tmdbSeriesDetail(701, "Succession"));
    await app.request(
      "/api/series/701/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 5 }),
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
        body: JSON.stringify({ rating: 3 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request("/api/series/entries", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; items: Array<Record<string, unknown>> };
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
  });

  it("filtra por favorito", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubTmdbFetchOnce(tmdbSeriesDetail(703, "Fargo"));
    await app.request(
      "/api/series/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 703 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubTmdbFetchOnce(tmdbSeriesDetail(704, "Ozark"));
    await app.request(
      "/api/series/704/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 3 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(
      "/api/series/entries?favorite=true",
      { headers: { cookie } },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; items: Array<Record<string, unknown>> };
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ series: { tmdbId: 703 } });
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/series/entries", undefined, env);

    expect(res.status).toBe(401);
  });
});

describe("GET/PUT /api/series/favorites", () => {
  it("sem sessão retorna 401 tanto pra GET quanto pra PUT", async () => {
    const getRes = await app.request("/api/series/favorites", undefined, env);
    expect(getRes.status).toBe(401);

    const putRes = await app.request(
      "/api/series/favorites/1",
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

    const res = await app.request("/api/series/favorites", { headers: { cookie } }, env);

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
    stubTmdbFetchOnce(tmdbSeriesDetail(620, "Fargo"));

    const putRes = await app.request(
      "/api/series/favorites/2",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 620 }),
      },
      env,
    );
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody).toMatchObject({ favoriteSlot: 2 });
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/series/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as {
      slots: Array<{ slot: number; entry: { series: { tmdbId: number } } | null }>;
    };
    expect(getBody.slots[1]).toMatchObject({ slot: 2, entry: { series: { tmdbId: 620 } } });
    expect(getBody.slots[0]).toEqual({ slot: 1, entry: null });
  });

  it("trocar um slot já ocupado libera a série que estava nele", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(621, "The Wire"));
    await app.request(
      "/api/series/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 621 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubTmdbFetchOnce(tmdbSeriesDetail(622, "Chernobyl"));
    await app.request(
      "/api/series/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 622 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/series/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as {
      slots: Array<{ slot: number; entry: { series: { tmdbId: number } } | null }>;
    };
    expect(getBody.slots[0]).toMatchObject({ slot: 1, entry: { series: { tmdbId: 622 } } });

    const entryRes = await app.request("/api/series/621", { headers: { cookie } }, env);
    const entryBody = (await entryRes.json()) as { entry: { favoriteSlot: number | null } | null };
    expect(entryBody.entry?.favoriteSlot ?? null).toBeNull();
  });

  it("escolher a mesma série pra outro slot move-a (não duplica em dois slots)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(623, "Better Call Saul"));
    await app.request(
      "/api/series/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 623 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const throwingFetch = vi
      .fn()
      .mockRejectedValue(new Error("já cacheada, não deveria chamar a TMDB de novo"));
    vi.stubGlobal("fetch", throwingFetch);
    await app.request(
      "/api/series/favorites/3",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 623 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/series/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as { slots: Array<{ slot: number; entry: unknown }> };
    expect(getBody.slots[0]).toEqual({ slot: 1, entry: null });
    expect(getBody.slots[2]?.entry).not.toBeNull();
  });

  it("slot inválido (fora de 1-4) retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request(
      "/api/series/favorites/5",
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
    stubTmdbFetchOnce(tmdbSeriesDetail(624, "The Sopranos"));

    await app.request(
      "/api/series/favorites/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: 624 }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const favorited = activities.filter(
      (item) => item.itemId === "624" && item.type === "favorited",
    );
    expect(favorited).toHaveLength(1);
  });
});

describe("GET /api/series/:tmdbId/seasons/:seasonNumber", () => {
  it("retorna os episódios da temporada, todos não assistidos", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeasonDetail(1, 2));

    const res = await app.request("/api/series/801/seasons/1", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      seasonNumber: 1,
      episodes: [
        {
          episodeNumber: 1,
          name: "Episódio 1",
          airDate: "2008-01-20",
          stillUrl: "https://image.tmdb.org/t/p/w185/still-s1e1.jpg",
          watched: false,
        },
        {
          episodeNumber: 2,
          name: "Episódio 2",
          airDate: "2008-01-20",
          stillUrl: "https://image.tmdb.org/t/p/w185/still-s1e2.jpg",
          watched: false,
        },
      ],
    });
    vi.unstubAllGlobals();
  });

  it("temporada inexistente na TMDB retorna 404", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404)),
    );

    const res = await app.request("/api/series/802/seasons/99", { headers: { cookie } }, env);

    expect(res.status).toBe(404);
    vi.unstubAllGlobals();
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/series/801/seasons/1", undefined, env);

    expect(res.status).toBe(401);
  });
});

describe("PUT /api/series/:tmdbId/episodes/:seasonNumber/:episodeNumber", () => {
  it("marca e desmarca um episódio, sem gerar atividade", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(901, "The Wire"));

    const markRes = await app.request(
      "/api/series/901/episodes/1/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );
    expect(markRes.status).toBe(204);
    vi.unstubAllGlobals();

    stubTmdbFetchOnce(tmdbSeasonDetail(1, 3));
    const seasonRes = await app.request("/api/series/901/seasons/1", { headers: { cookie } }, env);
    const seasonBody = (await seasonRes.json()) as {
      episodes: Array<{ episodeNumber: number; watched: boolean }>;
    };
    expect(seasonBody.episodes[0]).toMatchObject({ episodeNumber: 1, watched: true });
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    expect(activities.filter((item) => item.itemId === "901")).toHaveLength(0);

    // Série já cacheada — desmarcar não deveria chamar a TMDB de novo.
    const throwingFetch = vi.fn().mockRejectedValue(new Error("não deveria chamar a TMDB de novo"));
    vi.stubGlobal("fetch", throwingFetch);
    const unmarkRes = await app.request(
      "/api/series/901/episodes/1/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: false }),
      },
      env,
    );
    expect(unmarkRes.status).toBe(204);
    vi.unstubAllGlobals();

    stubTmdbFetchOnce(tmdbSeasonDetail(1, 3));
    const seasonRes2 = await app.request("/api/series/901/seasons/1", { headers: { cookie } }, env);
    const seasonBody2 = (await seasonRes2.json()) as {
      episodes: Array<{ episodeNumber: number; watched: boolean }>;
    };
    expect(seasonBody2.episodes[0]).toMatchObject({ episodeNumber: 1, watched: false });
    vi.unstubAllGlobals();
  });

  it("id inválido retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request(
      "/api/series/901/episodes/nao-e-um-id/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );

    expect(res.status).toBe(400);
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request(
      "/api/series/901/episodes/1/1",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );

    expect(res.status).toBe(401);
  });
});

describe("PUT /api/series/:tmdbId/seasons/:seasonNumber", () => {
  it("marca a temporada inteira e gera atividade season_watched", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(902, "Fargo"), tmdbSeasonDetail(1, 3));

    const res = await app.request(
      "/api/series/902/seasons/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );
    expect(res.status).toBe(204);
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const seasonWatched = activities.filter(
      (item) => item.itemId === "902" && item.type === "season_watched",
    );
    expect(seasonWatched).toHaveLength(1);
    expect(seasonWatched[0]?.metadata).toEqual({ season: 1, episodeCount: 3 });

    stubTmdbFetchOnce(tmdbSeasonDetail(1, 3));
    const seasonRes = await app.request("/api/series/902/seasons/1", { headers: { cookie } }, env);
    const seasonBody = (await seasonRes.json()) as { episodes: Array<{ watched: boolean }> };
    expect(seasonBody.episodes.every((episode) => episode.watched)).toBe(true);
    vi.unstubAllGlobals();
  });

  it("desmarca a temporada inteira sem gerar nova atividade", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbSeriesDetail(903, "Ozark"), tmdbSeasonDetail(1, 2));
    await app.request(
      "/api/series/903/seasons/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    // Série já cacheada — desmarcar não deveria chamar a TMDB de novo.
    const throwingFetch = vi.fn().mockRejectedValue(new Error("não deveria chamar a TMDB de novo"));
    vi.stubGlobal("fetch", throwingFetch);
    const res = await app.request(
      "/api/series/903/seasons/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: false }),
      },
      env,
    );
    expect(res.status).toBe(204);
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const seasonWatched = activities.filter(
      (item) => item.itemId === "903" && item.type === "season_watched",
    );
    expect(seasonWatched).toHaveLength(1); // só a marcação, não o clear

    stubTmdbFetchOnce(tmdbSeasonDetail(1, 2));
    const seasonRes = await app.request("/api/series/903/seasons/1", { headers: { cookie } }, env);
    const seasonBody = (await seasonRes.json()) as { episodes: Array<{ watched: boolean }> };
    expect(seasonBody.episodes.every((episode) => !episode.watched)).toBe(true);
    vi.unstubAllGlobals();
  });

  it("temporada inexistente na TMDB retorna 404", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    // Primeiro fetch cacheia a série (ensureSeriesEntry); o segundo busca a
    // temporada em si, que aqui responde 404.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(tmdbSeriesDetail(904, "Chernobyl")))
      .mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request(
      "/api/series/904/seasons/99",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );

    expect(res.status).toBe(404);
    vi.unstubAllGlobals();
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request(
      "/api/series/901/seasons/1",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );

    expect(res.status).toBe(401);
  });
});

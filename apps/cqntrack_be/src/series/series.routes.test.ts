import { env } from "cloudflare:workers";
import { eq, inArray } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { createDb } from "../db/client";
import { series, seriesEpisodeWatch, user } from "../db/schema";

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

// getOrCacheSeries busca detalhe + aggregate_credits em sequência — vazio
// por padrão nos testes que não se importam com elenco/direção especificamente.
function tmdbSeriesCredits(): { cast: unknown[]; crew: unknown[] } {
  return { cast: [], crew: [] };
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

// Helper pra quando o cache ainda não existe (ou está sendo revalidado) —
// getOrCacheSeries sempre faz os dois requests (detalhe + aggregate_credits)
// nesse caso, nessa ordem.
function stubSeriesCacheFetch(id: number, name: string): void {
  stubTmdbFetchOnce(tmdbSeriesDetail(id, name), tmdbSeriesCredits());
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

describe("GET /api/series/discover", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/series/discover", undefined, env);

    expect(res.status).toBe(401);
  });

  it("devolve as populares da TMDB mapeadas pro DTO, com hasMore calculado por total_pages", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce({ results: [TMDB_SEARCH_RESULT], page: 1, total_pages: 300 });

    const res = await app.request("/api/series/discover", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: unknown[]; page: number; hasMore: boolean };
    expect(body.page).toBe(1);
    expect(body.hasMore).toBe(true);
    expect(body.results).toEqual([
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
    ]);
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
    stubSeriesCacheFetch(501, "The Wire");

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
        cast: [],
        creators: [],
        directors: [],
      },
      entry: null,
    });
    vi.unstubAllGlobals();
  });

  it("cacheia elenco (top billed), criadores (de graça no detalhe) e direção (top por episódios)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(
      {
        ...tmdbSeriesDetail(505, "Breaking Bad"),
        created_by: [{ id: 66633, name: "Vince Gilligan", profile_path: "/gilligan.jpg" }],
      },
      {
        cast: [
          {
            id: 84497,
            name: "Aaron Paul",
            profile_path: "/paul.jpg",
            order: 1,
            roles: [{ character: "Jesse Pinkman", episode_count: 62 }],
          },
          {
            id: 17419,
            name: "Bryan Cranston",
            profile_path: "/cranston.jpg",
            order: 0,
            roles: [{ character: "Walter White", episode_count: 62 }],
          },
        ],
        crew: [
          {
            id: 111338,
            name: "Adam Bernstein",
            profile_path: "/bernstein.jpg",
            department: "Directing",
            jobs: [{ job: "Director", episode_count: 8 }],
          },
          {
            id: 29779,
            name: "Michelle MacLaren",
            profile_path: "/maclaren.jpg",
            department: "Directing",
            jobs: [{ job: "Director", episode_count: 11 }],
          },
          // Sem job "Director" — não pode entrar na lista de diretores.
          {
            id: 999,
            name: "Alguém da produção",
            profile_path: null,
            department: "Production",
            jobs: [{ job: "Producer", episode_count: 62 }],
          },
        ],
      },
    );

    const res = await app.request("/api/series/505", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      series: {
        cast: { personId: number; name: string; character: string; profileUrl: string | null }[];
        creators: { personId: number; name: string; profileUrl: string | null }[];
        directors: {
          personId: number;
          name: string;
          profileUrl: string | null;
          episodeCount: number;
        }[];
      };
    };
    // Reordenado por `order` (Cranston, order 0, vem antes de Paul, order 1);
    // `character` vem de roles[0].
    expect(body.series.cast).toEqual([
      {
        personId: 17419,
        name: "Bryan Cranston",
        character: "Walter White",
        profileUrl: "https://image.tmdb.org/t/p/w185/cranston.jpg",
      },
      {
        personId: 84497,
        name: "Aaron Paul",
        character: "Jesse Pinkman",
        profileUrl: "https://image.tmdb.org/t/p/w185/paul.jpg",
      },
    ]);
    expect(body.series.creators).toEqual([
      {
        personId: 66633,
        name: "Vince Gilligan",
        profileUrl: "https://image.tmdb.org/t/p/w185/gilligan.jpg",
      },
    ]);
    // Ordenado por episode_count decrescente (MacLaren, 11, antes de Bernstein,
    // 8); quem não tem job "Director" (o produtor) fica de fora.
    expect(body.series.directors).toEqual([
      {
        personId: 29779,
        name: "Michelle MacLaren",
        profileUrl: "https://image.tmdb.org/t/p/w185/maclaren.jpg",
        episodeCount: 11,
      },
      {
        personId: 111338,
        name: "Adam Bernstein",
        profileUrl: "https://image.tmdb.org/t/p/w185/bernstein.jpg",
        episodeCount: 8,
      },
    ]);
    vi.unstubAllGlobals();
  });

  it("se o request de créditos falhar, a série ainda é cacheada (cast/directors vazios, creators intacto)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ...tmdbSeriesDetail(506, "The Sopranos"),
          created_by: [{ id: 1, name: "David Chase", profile_path: null }],
        }),
      )
      .mockRejectedValueOnce(new Error("TMDB fora do ar"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/api/series/506", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      series: { name: string; cast: unknown[]; creators: { name: string }[]; directors: unknown[] };
    };
    expect(body.series.name).toBe("The Sopranos");
    expect(body.series.cast).toEqual([]);
    expect(body.series.creators).toEqual([{ personId: 1, name: "David Chase", profileUrl: null }]);
    expect(body.series.directors).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("não consulta a TMDB de novo quando a série já está cacheada", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubSeriesCacheFetch(502, "Fargo");
    await app.request("/api/series/502", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    const throwingFetch = vi.fn().mockRejectedValue(new Error("não deveria chamar a TMDB de novo"));
    vi.stubGlobal("fetch", throwingFetch);

    const res = await app.request("/api/series/502", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(throwingFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("revalida o cache depois de 24h (ex.: série ganhou uma temporada nova)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubSeriesCacheFetch(503, "Better Call Saul");
    await app.request("/api/series/503", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    // Simula o cache tendo mais de 24h.
    await createDb(env)
      .update(series)
      .set({ updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(series.tmdbId, 503));

    const base = tmdbSeriesDetail(503, "Better Call Saul");
    stubTmdbFetchOnce(
      {
        ...base,
        number_of_seasons: 6,
        seasons: [
          ...base.seasons,
          {
            season_number: 2,
            name: "Temporada 2",
            episode_count: 10,
            air_date: "2016-02-15",
            poster_path: "/poster-503-s2.jpg",
          },
        ],
      },
      tmdbSeriesCredits(),
    );

    const res = await app.request("/api/series/503", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2); // detalhe + créditos — revalidou de verdade, não usou o cache velho
    const body = (await res.json()) as {
      series: { numberOfSeasons: number; seasons: unknown[] };
    };
    expect(body.series.numberOfSeasons).toBe(6);
    expect(body.series.seasons).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it("mantém o cache velho se a TMDB estiver indisponível ao revalidar", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubSeriesCacheFetch(504, "Ozark");
    await app.request("/api/series/504", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    await createDb(env)
      .update(series)
      .set({ updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(series.tmdbId, 504));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404)),
    );

    const res = await app.request("/api/series/504", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { series: { name: string } };
    expect(body.series.name).toBe("Ozark");
    vi.unstubAllGlobals();
  });
});

describe("CRUD de marcação (/api/series/:tmdbId/entry)", () => {
  it("PUT cria uma marcação nova, com nota e review", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubSeriesCacheFetch(601, "Better Call Saul");

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
      favoritedAt: null,
    });
    vi.unstubAllGlobals();
  });

  it("PUT com payload parcial não apaga campos já preenchidos", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubSeriesCacheFetch(602, "Ozark");
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
    stubSeriesCacheFetch(604, "The Sopranos");

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
    stubSeriesCacheFetch(603, "Chernobyl");
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

    stubSeriesCacheFetch(603, "Chernobyl");
    const detailRes = await app.request("/api/series/603", { headers: { cookie } }, env);
    await expect(detailRes.json()).resolves.toMatchObject({ entry: null });
    vi.unstubAllGlobals();
  });
});

describe("GET /api/series/entries", () => {
  it("lista só as marcações do usuário logado", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubSeriesCacheFetch(701, "Succession");
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

    stubSeriesCacheFetch(702, "The Bear");
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

    stubSeriesCacheFetch(703, "Fargo");
    await app.request(
      "/api/series/703/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubSeriesCacheFetch(704, "Ozark");
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

  it("availableEpisode vem preenchido quando o último episódio lançado ainda não foi assistido", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubTmdbFetchOnce(
      {
        ...tmdbSeriesDetail(705, "Slow Horses"),
        last_episode_to_air: {
          episode_number: 6,
          season_number: 4,
          name: "Hello Goodbye",
          air_date: "2025-01-01",
        },
      },
      tmdbSeriesCredits(),
    );
    await app.request(
      "/api/series/705/entry",
      { method: "PUT", headers: { cookie, "Content-Type": "application/json" }, body: "{}" },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request("/api/series/entries", { headers: { cookie } }, env);
    const body = (await res.json()) as {
      items: Array<{ availableEpisode: unknown; upcomingEpisode: unknown }>;
    };

    expect(body.items[0]?.availableEpisode).toEqual({
      seasonNumber: 4,
      episodeNumber: 6,
      name: "Hello Goodbye",
      airDate: "2025-01-01",
    });
    expect(body.items[0]?.upcomingEpisode).toBeNull();
  });

  it("availableEpisode vem null quando o último episódio já foi assistido", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    // watched=true passa por ensureSeriesEntry -> getOrCacheSeries (sem
    // options, fetchCredits: true por padrão) — 2 requests, mesma ordem de
    // stubSeriesCacheFetch (detalhe + aggregate_credits).
    stubTmdbFetchOnce(
      {
        ...tmdbSeriesDetail(706, "Severance"),
        last_episode_to_air: {
          episode_number: 1,
          season_number: 1,
          name: "Good News About Hell",
          air_date: "2025-01-01",
        },
      },
      tmdbSeriesCredits(),
    );
    await app.request(
      "/api/series/706/episodes/1/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request("/api/series/entries", { headers: { cookie } }, env);
    const body = (await res.json()) as { items: Array<{ availableEpisode: unknown }> };

    expect(body.items[0]?.availableEpisode).toBeNull();
  });

  it("upcomingEpisode vem preenchido quando next_episode_to_air é uma data futura", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubTmdbFetchOnce(
      {
        ...tmdbSeriesDetail(707, "The Bear"),
        next_episode_to_air: {
          episode_number: 1,
          season_number: 5,
          name: "TBA",
          air_date: "2027-01-01",
        },
      },
      tmdbSeriesCredits(),
    );
    await app.request(
      "/api/series/707/entry",
      { method: "PUT", headers: { cookie, "Content-Type": "application/json" }, body: "{}" },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request("/api/series/entries", { headers: { cookie } }, env);
    const body = (await res.json()) as { items: Array<{ upcomingEpisode: unknown }> };

    expect(body.items[0]?.upcomingEpisode).toEqual({
      seasonNumber: 5,
      episodeNumber: 1,
      name: "TBA",
      airDate: "2027-01-01",
    });
  });
});

describe("GET /api/series/favorites", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/series/favorites", undefined, env);
    expect(res.status).toBe(401);
  });

  it("começa vazio", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/series/favorites", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items: [] });
  });

  it("favoritar via PUT .../entry reflete no GET, mais recente primeiro, sem limite de quantidade", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubSeriesCacheFetch(620, "Fargo");

    const putRes = await app.request(
      "/api/series/620/entry",
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
    vi.unstubAllGlobals();

    stubSeriesCacheFetch(622, "Chernobyl");
    await app.request(
      "/api/series/622/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/series/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as { items: Array<{ series: { tmdbId: number } }> };
    expect(getBody.items.map((item) => item.series.tmdbId)).toEqual([622, 620]);
  });

  it("desfavoritar tira da lista", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubSeriesCacheFetch(621, "The Wire");
    await app.request(
      "/api/series/621/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    await app.request(
      "/api/series/621/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: false }),
      },
      env,
    );

    const getRes = await app.request("/api/series/favorites", { headers: { cookie } }, env);
    await expect(getRes.json()).resolves.toEqual({ items: [] });

    const entryRes = await app.request("/api/series/621", { headers: { cookie } }, env);
    const entryBody = (await entryRes.json()) as { entry: { favoritedAt: string | null } | null };
    expect(entryBody.entry?.favoritedAt ?? null).toBeNull();
  });

  it("favoritar gera atividade do tipo favorited; desfavoritar não", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubSeriesCacheFetch(624, "The Sopranos");

    await app.request(
      "/api/series/624/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    await app.request(
      "/api/series/624/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: false }),
      },
      env,
    );

    const activities = await createDb(env).query.activity.findMany();
    const favorited = activities.filter(
      (item) => item.itemId === "624" && item.type === "favorited",
    );
    expect(favorited).toHaveLength(1);
  });
});

describe("GET /api/series/continue-watching", () => {
  async function getUserId(email: string): Promise<string> {
    const [row] = await createDb(env)
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    if (!row) throw new Error("usuário de teste não encontrado");
    return row.id;
  }

  async function ageSeriesCache(tmdbId: number): Promise<void> {
    await createDb(env)
      .update(series)
      .set({ updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(series.tmdbId, tmdbId));
  }

  // Cacheia a série (temporada 1 com 3 episódios, ver tmdbSeriesDetail) e
  // marca o 1x1 assistido — mesmo request de sempre, 2 responses (detalhe +
  // créditos) pela ordem de getOrCacheSeries.
  async function watchFirstEpisode(cookie: string, tmdbId: number, name: string): Promise<void> {
    stubSeriesCacheFetch(tmdbId, name);
    await app.request(
      `/api/series/${tmdbId}/episodes/1/1`,
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );
    vi.unstubAllGlobals();
  }

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/series/continue-watching", undefined, env);
    expect(res.status).toBe(401);
  });

  it("começa vazio", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/series/continue-watching", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items: [] });
  });

  it("série só favoritada (nenhum episódio assistido) não aparece", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubSeriesCacheFetch(701, "Série sem episódio assistido");
    await app.request(
      "/api/series/701/entry",
      { method: "PUT", headers: { cookie, "Content-Type": "application/json" }, body: "{}" },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request("/api/series/continue-watching", { headers: { cookie } }, env);
    await expect(res.json()).resolves.toEqual({ items: [] });
  });

  it("caso A: lacuna já visível pelo cache (assistidos < episódios da temporada) acha o episódio exato", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    await watchFirstEpisode(cookie, 702, "Série com lacuna");

    // Só falta consultar a temporada 1 — o cache da série já está fresco,
    // não deveria gerar nenhuma outra chamada.
    stubTmdbFetchOnce(tmdbSeasonDetail(1, 3));

    const res = await app.request("/api/series/continue-watching", { headers: { cookie } }, env);
    const body = (await res.json()) as {
      items: Array<{
        series: { tmdbId: number };
        nextEpisode: { seasonNumber: number; episodeNumber: number; name: string; airDate: string };
        recentlyActive: boolean;
      }>;
    };
    vi.unstubAllGlobals();

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.series.tmdbId).toBe(702);
    expect(body.items[0]?.nextEpisode).toEqual({
      seasonNumber: 1,
      episodeNumber: 2,
      name: "Episódio 2",
      airDate: "2008-01-20",
    });
  });

  it("caso B: série ended com tudo assistido não aparece, mesmo com cache velho (não reconsulta a TMDB)", async () => {
    const { cookie, email } = await createAuthenticatedUser(app, env);
    const userId = await getUserId(email);
    const db = createDb(env);

    await watchFirstEpisode(cookie, 703, "Série encerrada");
    await db.insert(seriesEpisodeWatch).values([
      { userId, seriesId: 703, seasonNumber: 1, episodeNumber: 2 },
      { userId, seriesId: 703, seasonNumber: 1, episodeNumber: 3 },
    ]);
    await db.update(series).set({ status: "Ended" }).where(eq(series.tmdbId, 703));
    await ageSeriesCache(703);

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await app.request("/api/series/continue-watching", { headers: { cookie } }, env);
    await expect(res.json()).resolves.toEqual({ items: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("caso C, cache fresco: série ativa com tudo assistido não aparece nem gasta chamada dentro de 24h", async () => {
    const { cookie, email } = await createAuthenticatedUser(app, env);
    const userId = await getUserId(email);
    const db = createDb(env);

    await watchFirstEpisode(cookie, 704, "Série ativa em dia");
    await db.insert(seriesEpisodeWatch).values([
      { userId, seriesId: 704, seasonNumber: 1, episodeNumber: 2 },
      { userId, seriesId: 704, seasonNumber: 1, episodeNumber: 3 },
    ]);
    await db.update(series).set({ status: "Returning Series" }).where(eq(series.tmdbId, 704));

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await app.request("/api/series/continue-watching", { headers: { cookie } }, env);
    await expect(res.json()).resolves.toEqual({ items: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("caso C, cache velho: reconsulta a TMDB e revela episódio novo lançado desde a última checagem", async () => {
    const { cookie, email } = await createAuthenticatedUser(app, env);
    const userId = await getUserId(email);
    const db = createDb(env);

    await watchFirstEpisode(cookie, 705, "Série ativa desatualizada");
    await db.insert(seriesEpisodeWatch).values([
      { userId, seriesId: 705, seasonNumber: 1, episodeNumber: 2 },
      { userId, seriesId: 705, seasonNumber: 1, episodeNumber: 3 },
    ]);
    await db.update(series).set({ status: "Returning Series" }).where(eq(series.tmdbId, 705));
    await ageSeriesCache(705);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/aggregate_credits")) {
          return jsonResponse(tmdbSeriesCredits());
        }
        if (url.includes("/season/")) {
          return jsonResponse(tmdbSeasonDetail(1, 4));
        }
        return jsonResponse({
          ...tmdbSeriesDetail(705, "Série ativa desatualizada"),
          status: "Returning Series",
          seasons: [
            {
              season_number: 1,
              name: "Temporada 1",
              episode_count: 4,
              air_date: "2008-01-20",
              poster_path: "/poster-705-s1.jpg",
            },
          ],
        });
      }),
    );

    const res = await app.request("/api/series/continue-watching", { headers: { cookie } }, env);
    const body = (await res.json()) as {
      items: Array<{ nextEpisode: { seasonNumber: number; episodeNumber: number } }>;
    };
    vi.unstubAllGlobals();

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.nextEpisode).toEqual({
      seasonNumber: 1,
      episodeNumber: 4,
      name: "Episódio 4",
      airDate: "2008-01-20",
    });
  });

  it("ordena quem assistiu algo nos últimos 3 meses primeiro; dentro de cada grupo, episódio liberado mais recentemente primeiro", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const db = createDb(env);

    const setups = [
      { id: 711, name: "Sem atividade recente, episódio mais antigo", airDate: "2020-01-01" },
      { id: 712, name: "Sem atividade recente, episódio mais novo", airDate: "2020-02-01" },
      { id: 713, name: "Atividade recente", airDate: "2019-12-01" },
    ];
    const airDateById = new Map(setups.map((s) => [s.id, s.airDate]));

    for (const s of setups) {
      await watchFirstEpisode(cookie, s.id, s.name);
    }

    // Atividade recente (< 3 meses) só na 713; as demais ficam velhas de
    // propósito (> 3 meses) pra não contar como recentlyActive.
    await db
      .update(seriesEpisodeWatch)
      .set({ watchedAt: new Date() })
      .where(eq(seriesEpisodeWatch.seriesId, 713));
    await db
      .update(seriesEpisodeWatch)
      .set({ watchedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) })
      .where(inArray(seriesEpisodeWatch.seriesId, [711, 712]));

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const match = /\/tv\/(\d+)\/season\//.exec(url);
        const id = Number(match?.[1]);
        return jsonResponse({
          season_number: 1,
          episodes: [
            { episode_number: 1, name: "Episódio 1", air_date: "2008-01-20", still_path: null },
            {
              episode_number: 2,
              name: "Episódio 2",
              air_date: airDateById.get(id),
              still_path: null,
            },
            {
              episode_number: 3,
              name: "Episódio 3",
              air_date: airDateById.get(id),
              still_path: null,
            },
          ],
        });
      }),
    );

    const res = await app.request("/api/series/continue-watching", { headers: { cookie } }, env);
    const body = (await res.json()) as { items: Array<{ series: { tmdbId: number } }> };
    vi.unstubAllGlobals();

    expect(body.items.map((item) => item.series.tmdbId)).toEqual([713, 712, 711]);
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

function tmdbEpisodeDetail(
  seasonNumber: number,
  episodeNumber: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    episode_number: episodeNumber,
    season_number: seasonNumber,
    name: `Episódio ${episodeNumber}`,
    overview: `Sinopse do episódio ${episodeNumber}`,
    air_date: "2008-01-20",
    still_path: `/still-s${seasonNumber}e${episodeNumber}.jpg`,
    runtime: 58,
    vote_average: 8.2,
    crew: [
      {
        id: 66633,
        name: "Vince Gilligan",
        job: "Director",
        department: "Directing",
        profile_path: "/gilligan.jpg",
      },
      // Crédito duplicado — não pode aparecer duas vezes na resposta.
      {
        id: 66633,
        name: "Vince Gilligan",
        job: "Director",
        department: "Directing",
        profile_path: "/gilligan.jpg",
      },
      {
        id: 999,
        name: "Alguém da fotografia",
        job: "Director of Photography",
        department: "Camera",
        profile_path: null,
      },
    ],
    ...overrides,
  };
}

describe("GET /api/series/:tmdbId/episodes/:seasonNumber/:episodeNumber", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/series/901/episodes/1/1", undefined, env);

    expect(res.status).toBe(401);
  });

  it("id inválido retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request(
      "/api/series/901/episodes/nao-e-um-id/1",
      { headers: { cookie } },
      env,
    );

    expect(res.status).toBe(400);
  });

  it("episódio inexistente na TMDB retorna 404", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404)),
    );

    const res = await app.request("/api/series/901/episodes/1/999", { headers: { cookie } }, env);

    expect(res.status).toBe(404);
    vi.unstubAllGlobals();
  });

  it("devolve nome, sinopse, still, direção (deduplicada) e watched: false quando não marcado", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(tmdbEpisodeDetail(1, 1))));

    const res = await app.request("/api/series/905/episodes/1/1", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      seasonNumber: 1,
      episodeNumber: 1,
      name: "Episódio 1",
      overview: "Sinopse do episódio 1",
      airDate: "2008-01-20",
      stillUrl: "https://image.tmdb.org/t/p/w342/still-s1e1.jpg",
      runtime: 58,
      rating: 8.2,
      watched: false,
      // Só o job "Director" entra (Director of Photography fica de fora),
      // sem duplicar Vince Gilligan.
      directors: [
        {
          personId: 66633,
          name: "Vince Gilligan",
          profileUrl: "https://image.tmdb.org/t/p/w185/gilligan.jpg",
        },
      ],
    });
    vi.unstubAllGlobals();
  });

  it("watched: true depois que o episódio é marcado (mesma tabela da lista da temporada)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubSeriesCacheFetch(906, "Breaking Bad");
    await app.request(
      "/api/series/906/episodes/1/1",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ watched: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(tmdbEpisodeDetail(1, 1))));
    const res = await app.request("/api/series/906/episodes/1/1", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { watched: boolean };
    expect(body.watched).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe("PUT /api/series/:tmdbId/episodes/:seasonNumber/:episodeNumber", () => {
  it("marca e desmarca um episódio, sem gerar atividade", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubSeriesCacheFetch(901, "The Wire");

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
    stubTmdbFetchOnce(tmdbSeriesDetail(902, "Fargo"), tmdbSeriesCredits(), tmdbSeasonDetail(1, 3));

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
    stubTmdbFetchOnce(tmdbSeriesDetail(903, "Ozark"), tmdbSeriesCredits(), tmdbSeasonDetail(1, 2));
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
    // Os dois primeiros fetches cacheiam a série (ensureSeriesEntry: detalhe
    // + créditos); o terceiro busca a temporada em si, que aqui responde 404.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(tmdbSeriesDetail(904, "Chernobyl")))
      .mockResolvedValueOnce(jsonResponse(tmdbSeriesCredits()))
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

describe("POST /api/series/import/tvtime", () => {
  function tmdbFindResponse(tmdbId: number | null) {
    return { tv_results: tmdbId === null ? [] : [{ id: tmdbId, name: "Breaking Bad" }] };
  }

  it("sem sessão retorna 401", async () => {
    const res = await app.request(
      "/api/series/import/tvtime",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesTvdbId: 81189,
          title: "Breaking Bad",
          episodes: [{ season: 1, episode: 1 }],
        }),
      },
      env,
    );

    expect(res.status).toBe(401);
  });

  it("corpo inválido (sem episódios) retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request(
      "/api/series/import/tvtime",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ seriesTvdbId: 81189, title: "Breaking Bad", episodes: [] }),
      },
      env,
    );

    expect(res.status).toBe(400);
  });

  it("resolve o tvdb_id na TMDB e marca os episódios assistidos em lote, sem buscar créditos", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    // Só 2 fetches: resolução por tvdb_id + detalhe da série — sem
    // aggregate_credits nem fallback de sinopse en-US (fetchCredits/
    // fetchOverviewFallback: false durante import em massa, ver
    // import.service.ts). Se o código voltar a chamar um 3º fetch, o mock
    // não tem resposta pra ele e o teste falha.
    stubTmdbFetchOnce(tmdbFindResponse(1396), tmdbSeriesDetail(1396, "Breaking Bad"));

    const res = await app.request(
      "/api/series/import/tvtime",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesTvdbId: 81189,
          title: "Breaking Bad",
          episodes: [
            { season: 1, episode: 1, watchedAt: "2020-03-05T03:05:10.000Z" },
            { season: 1, episode: 2, watchedAt: "2020-03-05T03:05:10.000Z" },
          ],
        }),
      },
      env,
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      seriesTvdbId: number;
      status: string;
      episodesImported: number;
    };
    expect(body).toMatchObject({ seriesTvdbId: 81189, status: "imported", episodesImported: 2 });

    const db = createDb(env);
    const watches = await db.query.seriesEpisodeWatch.findMany({
      where: (table, { eq: eqOp }) => eqOp(table.seriesId, 1396),
    });
    expect(watches).toHaveLength(2);
    expect(watches.map((w) => w.episodeNumber).sort()).toEqual([1, 2]);
    expect(watches[0]?.watchedAt.toISOString()).toBe("2020-03-05T03:05:10.000Z");

    const seriesRow = await db.query.series.findFirst({
      where: (table, { eq: eqOp }) => eqOp(table.tmdbId, 1396),
    });
    // fetchCredits: false — cast fica null (== "nunca buscou"), não `[]`.
    expect(seriesRow?.cast).toBeNull();
  });

  it("tvdb_id sem correspondência na TMDB vira not_found, sem gravar nada", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbFindResponse(null));

    const res = await app.request(
      "/api/series/import/tvtime",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesTvdbId: 999999,
          title: "Série Desconhecida",
          episodes: [{ season: 1, episode: 1 }],
        }),
      },
      env,
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; episodesImported: number };
    expect(body).toMatchObject({ status: "not_found", episodesImported: 0 });
  });

  it("série com centenas de episódios grava tudo, em vários INSERTs em lote", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbFindResponse(1500), tmdbSeriesDetail(1500, "One Piece"));

    const episodes = Array.from({ length: 320 }, (_, index) => ({
      season: 1,
      episode: index + 1,
    }));
    const res = await app.request(
      "/api/series/import/tvtime",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ seriesTvdbId: 12345, title: "One Piece", episodes }),
      },
      env,
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { episodesImported: number };
    expect(body.episodesImported).toBe(320);

    const db = createDb(env);
    const watches = await db.query.seriesEpisodeWatch.findMany({
      where: (table, { eq: eqOp }) => eqOp(table.seriesId, 1500),
    });
    expect(watches).toHaveLength(320);
  });
});

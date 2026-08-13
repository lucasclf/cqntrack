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

// getOrCacheMovie busca detalhe + créditos em paralelo — vazio por padrão
// nos testes que não se importam com elenco/direção especificamente.
function tmdbMovieCredits(): { cast: unknown[]; crew: unknown[] } {
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
// getOrCacheMovie sempre faz os dois requests (detalhe + créditos) nesse caso.
function stubMovieCacheFetch(id: number, title: string, voteAverage = 8.4): void {
  stubTmdbFetchOnce(
    { ...tmdbMovieDetail(id, title), vote_average: voteAverage },
    tmdbMovieCredits(),
  );
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

describe("GET /api/movies/discover", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/movies/discover", undefined, env);

    expect(res.status).toBe(401);
  });

  it("devolve os populares da TMDB mapeados pro DTO, com hasMore calculado por total_pages", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce({ results: [TMDB_SEARCH_RESULT], page: 1, total_pages: 500 });

    const res = await app.request("/api/movies/discover", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
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
      page: 1,
      hasMore: true,
    });
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url.toString()).toBe("https://api.themoviedb.org/3/movie/popular?page=1&language=pt-BR");
    vi.unstubAllGlobals();
  });

  it("hasMore é false na última página", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce({ results: [TMDB_SEARCH_RESULT], page: 500, total_pages: 500 });

    const res = await app.request("/api/movies/discover?page=500", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { hasMore: boolean };
    expect(body.hasMore).toBe(false);
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
    stubMovieCacheFetch(501, "The Matrix");

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
        cast: [],
        directors: [],
      },
      entry: null,
    });
    vi.unstubAllGlobals();
  });

  it("cacheia elenco (top billed, por ordem) e direção (dedupe por pessoa)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubTmdbFetchOnce(tmdbMovieDetail(507, "Inception"), {
      cast: [
        {
          id: 24045,
          name: "Joseph Gordon-Levitt",
          character: "Arthur",
          profile_path: "/jgl.jpg",
          order: 1,
        },
        {
          id: 6193,
          name: "Leonardo DiCaprio",
          character: "Dom Cobb",
          profile_path: "/dicaprio.jpg",
          order: 0,
        },
      ],
      crew: [
        {
          id: 559,
          name: "Wally Pfister",
          job: "Director of Photography",
          department: "Camera",
          profile_path: null,
        },
        {
          id: 525,
          name: "Christopher Nolan",
          job: "Director",
          department: "Directing",
          profile_path: "/nolan.jpg",
        },
        // Crédito duplicado do próprio Nolan (acontece na TMDB) — não pode
        // aparecer duas vezes na lista de diretores.
        {
          id: 525,
          name: "Christopher Nolan",
          job: "Director",
          department: "Directing",
          profile_path: "/nolan.jpg",
        },
      ],
    });

    const res = await app.request("/api/movies/507", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      movie: {
        cast: { personId: number; name: string; character: string; profileUrl: string | null }[];
        directors: { personId: number; name: string; profileUrl: string | null }[];
      };
    };
    // Reordenado por `order` (DiCaprio, order 0, vem antes de Gordon-Levitt, order 1).
    expect(body.movie.cast).toEqual([
      {
        personId: 6193,
        name: "Leonardo DiCaprio",
        character: "Dom Cobb",
        profileUrl: "https://image.tmdb.org/t/p/w185/dicaprio.jpg",
      },
      {
        personId: 24045,
        name: "Joseph Gordon-Levitt",
        character: "Arthur",
        profileUrl: "https://image.tmdb.org/t/p/w185/jgl.jpg",
      },
    ]);
    // Só o job "Director" entra (Director of Photography fica de fora), sem duplicar Nolan.
    expect(body.movie.directors).toEqual([
      {
        personId: 525,
        name: "Christopher Nolan",
        profileUrl: "https://image.tmdb.org/t/p/w185/nolan.jpg",
      },
    ]);
    vi.unstubAllGlobals();
  });

  it("se o request de créditos falhar, o filme ainda é cacheado (cast/directors vazios)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(tmdbMovieDetail(508, "Tenet")))
      .mockRejectedValueOnce(new Error("TMDB fora do ar"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/api/movies/508", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      movie: { name: string; cast: unknown[]; directors: unknown[] };
    };
    expect(body.movie.name).toBe("Tenet");
    expect(body.movie.cast).toEqual([]);
    expect(body.movie.directors).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("não consulta a TMDB de novo quando o filme já está cacheado", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMovieCacheFetch(502, "Interstellar");
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
    stubMovieCacheFetch(503, "Dunkirk");
    await app.request("/api/movies/503", { headers: { cookie } }, env);
    vi.unstubAllGlobals();

    // Simula o cache tendo mais de 24h.
    await createDb(env)
      .update(movie)
      .set({ updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(movie.tmdbId, 503));

    stubMovieCacheFetch(503, "Dunkirk", 9.1);

    const res = await app.request("/api/movies/503", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2); // detalhe + créditos — revalidou de verdade, não usou o cache velho
    const body = (await res.json()) as { movie: { rating: number } };
    expect(body.movie.rating).toBe(9.1);
    vi.unstubAllGlobals();
  });

  it("mantém o cache velho se a TMDB estiver indisponível ao revalidar", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMovieCacheFetch(504, "Tenet");
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
  it("PUT cria uma marcação nova, com nota e review, sem status", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMovieCacheFetch(601, "Oppenheimer");

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
      status: null,
      rating: 4.5,
      review: "Excelente",
      watchedAt: null,
      favoritedAt: null,
    });
    vi.unstubAllGlobals();
  });

  it("PUT com status: watched marca watchedAt; status: want_to_watch limpa watchedAt", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMovieCacheFetch(602, "Barbie");

    const markRes = await app.request(
      "/api/movies/602/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "watched" }),
      },
      env,
    );
    expect(markRes.status).toBe(200);
    const markBody = (await markRes.json()) as { status: string | null; watchedAt: string | null };
    expect(markBody.status).toBe("watched");
    expect(markBody.watchedAt).not.toBeNull();
    vi.unstubAllGlobals();

    const unmarkRes = await app.request(
      "/api/movies/602/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "want_to_watch" }),
      },
      env,
    );
    expect(unmarkRes.status).toBe(200);
    const unmarkBody = (await unmarkRes.json()) as {
      status: string | null;
      watchedAt: string | null;
    };
    expect(unmarkBody.status).toBe("want_to_watch");
    expect(unmarkBody.watchedAt).toBeNull();
  });

  it("PUT com payload parcial não apaga campos já preenchidos", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMovieCacheFetch(603, "Poor Things");
    await app.request(
      "/api/movies/603/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 3.5, status: "watched" }),
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

  it("marcar status: watched gera atividade status_changed; desmarcar (status: null) não gera atividade extra", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMovieCacheFetch(604, "Killers of the Flower Moon");

    await app.request(
      "/api/movies/604/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "watched" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    await app.request(
      "/api/movies/604/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: null }),
      },
      env,
    );

    const activities = await createDb(env).query.activity.findMany();
    const statusChanged = activities.filter(
      (item) => item.itemId === "604" && item.type === "status_changed",
    );
    expect(statusChanged).toHaveLength(1); // só a marcação, não o clear
  });

  it("PUT com nota gera atividade rated", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMovieCacheFetch(605, "Anatomy of a Fall");

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
    stubMovieCacheFetch(606, "The Zone of Interest");
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

    stubMovieCacheFetch(606, "The Zone of Interest");
    const detailRes = await app.request("/api/movies/606", { headers: { cookie } }, env);
    await expect(detailRes.json()).resolves.toMatchObject({ entry: null });
    vi.unstubAllGlobals();
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request(
      "/api/movies/601/entry",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 3 }),
      },
      env,
    );

    expect(res.status).toBe(401);
  });
});

describe("GET /api/movies/entries", () => {
  it("lista só as marcações do usuário logado, filtrando por status", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    stubMovieCacheFetch(701, "Past Lives");
    await app.request(
      "/api/movies/701/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "watched" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    stubMovieCacheFetch(702, "Priscilla");
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

    const res = await app.request(
      "/api/movies/entries?status=watched",
      { headers: { cookie } },
      env,
    );

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

describe("GET /api/movies/favorites", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/movies/favorites", undefined, env);
    expect(res.status).toBe(401);
  });

  it("começa vazio", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/movies/favorites", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items: [] });
  });

  it("favoritar via PUT .../entry reflete no GET, mais recente primeiro, sem limite de quantidade", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMovieCacheFetch(801, "Parasite");

    const putRes = await app.request(
      "/api/movies/801/entry",
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

    stubMovieCacheFetch(802, "The Whale");
    await app.request(
      "/api/movies/802/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const getRes = await app.request("/api/movies/favorites", { headers: { cookie } }, env);
    const getBody = (await getRes.json()) as { items: Array<{ movie: { tmdbId: number } }> };
    // Mais recente favoritado primeiro.
    expect(getBody.items.map((item) => item.movie.tmdbId)).toEqual([802, 801]);
  });

  it("desfavoritar tira da lista", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMovieCacheFetch(803, "Nomadland");
    await app.request(
      "/api/movies/803/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    await app.request(
      "/api/movies/803/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: false }),
      },
      env,
    );

    const getRes = await app.request("/api/movies/favorites", { headers: { cookie } }, env);
    await expect(getRes.json()).resolves.toEqual({ items: [] });
  });

  it("favoritar gera atividade do tipo favorited; desfavoritar não", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    stubMovieCacheFetch(805, "CODA");

    await app.request(
      "/api/movies/805/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    await app.request(
      "/api/movies/805/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: false }),
      },
      env,
    );

    const activities = await createDb(env).query.activity.findMany();
    const favorited = activities.filter(
      (item) => item.itemId === "805" && item.type === "favorited",
    );
    expect(favorited).toHaveLength(1);
  });
});

describe("POST /api/movies/import/filmow", () => {
  // Roda com CONCURRENCY>1 dentro do service (ver import.service.ts), então
  // um mock de fetch baseado em fila (fifo) não é confiável — os fetches
  // dos vários títulos intercalam. Responde por conteúdo da URL em vez de
  // ordem de chamada.
  function stubTmdbByUrl(handlers: [pattern: string, body: unknown][]): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        for (const [pattern, body] of handlers) {
          if (url.includes(pattern)) return jsonResponse(body);
        }
        throw new Error("URL inesperada no teste: " + url);
      }),
    );
  }

  it("sem sessão retorna 401", async () => {
    const res = await app.request(
      "/api/movies/import/filmow",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: ["Inception"] }),
      },
      env,
    );

    expect(res.status).toBe(401);
  });

  it("corpo inválido (sem títulos, ou mais de 10) retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const emptyRes = await app.request(
      "/api/movies/import/filmow",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ titles: [] }),
      },
      env,
    );
    expect(emptyRes.status).toBe(400);

    const tooManyRes = await app.request(
      "/api/movies/import/filmow",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ titles: Array.from({ length: 11 }, (_, i) => `Filme ${i}`) }),
      },
      env,
    );
    expect(tooManyRes.status).toBe(400);
  });

  it("título encontrado vira marcação 'Já vi' sem gerar atividade; título sem match vira not_found", async () => {
    const { cookie, username } = await createAuthenticatedUser(app, env);

    // Sem stub de "/movie/27205/credits" de propósito — import em massa
    // pula esse request (fetchCredits: false, ver import.service.ts); se o
    // código voltar a chamá-lo, o mock lança "URL inesperada" e o teste falha.
    stubTmdbByUrl([
      ["/search/movie?query=Inception", { results: [TMDB_SEARCH_RESULT] }],
      ["/movie/27205", tmdbMovieDetail(27205, "Inception")],
      ["/search/movie?query=Zzznotfound", { results: [] }],
    ]);

    const res = await app.request(
      "/api/movies/import/filmow",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ titles: ["Inception", "Zzznotfound"] }),
      },
      env,
    );
    vi.unstubAllGlobals();

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Array<{ title: string; status: string; movie: { tmdbId: number } | null }>;
    };
    expect(body.results).toHaveLength(2);

    const inception = body.results.find((r) => r.title === "Inception");
    expect(inception).toMatchObject({ status: "imported", movie: { tmdbId: 27205 } });

    const notFound = body.results.find((r) => r.title === "Zzznotfound");
    expect(notFound).toMatchObject({ status: "not_found", movie: null });

    const entriesRes = await app.request(
      `/api/users/${username}/movies/entries?status=watched`,
      undefined,
      env,
    );
    const entriesBody = (await entriesRes.json()) as {
      items: Array<{ movie: { tmdbId: number } }>;
    };
    expect(entriesBody.items).toEqual([
      expect.objectContaining({ movie: expect.objectContaining({ tmdbId: 27205 }) }),
    ]);

    // Import em massa não deve poluir o feed de atividade.
    const activities = await createDb(env).query.activity.findMany();
    expect(activities.filter((item) => item.itemId === "27205")).toHaveLength(0);

    // fetchCredits: false — elenco/direção ficam null (backfilam sozinhos
    // na próxima vez que alguém abrir o detalhe do filme de verdade).
    const [cachedMovie] = await createDb(env).select().from(movie).where(eq(movie.tmdbId, 27205));
    expect(cachedMovie?.cast).toBeNull();
    expect(cachedMovie?.directors).toBeNull();
  });
});

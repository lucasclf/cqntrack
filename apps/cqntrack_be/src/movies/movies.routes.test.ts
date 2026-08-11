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

import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";

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
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ results: [TMDB_SEARCH_RESULT] }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/api/series/search?q=breaking+bad", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

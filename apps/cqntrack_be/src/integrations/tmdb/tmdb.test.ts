import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { getSeriesById, getSeriesSeason, searchSeries } from "./series";

const SERIES_SEARCH_RESULT = {
  id: 1396,
  name: "Breaking Bad",
  poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  first_air_date: "2008-01-20",
  genre_ids: [18, 80],
  vote_average: 8.9,
};

const SERIES_DETAIL = {
  id: 1396,
  name: "Breaking Bad",
  poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  first_air_date: "2008-01-20",
  overview: "Um professor de química com câncer terminal vira fabricante de metanfetamina.",
  genres: [
    { id: 18, name: "Drama" },
    { id: 80, name: "Crime" },
  ],
  number_of_seasons: 5,
  number_of_episodes: 62,
  vote_average: 8.9,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("integrations/tmdb", () => {
  it("busca séries com Authorization: Bearer, sem etapa de token separada", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [SERIES_SEARCH_RESULT] }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchSeries(env, "breaking bad");

    expect(results).toEqual([SERIES_SEARCH_RESULT]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(
      "https://api.themoviedb.org/3/search/tv?query=breaking%20bad&include_adult=false",
    );
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: expect.stringContaining("Bearer "),
    });

    vi.unstubAllGlobals();
  });

  it("getSeriesById devolve o detalhe completo (com gêneros nomeados)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(SERIES_DETAIL));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSeriesById(env, 1396);

    expect(result).toEqual(SERIES_DETAIL);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.themoviedb.org/3/tv/1396",
      expect.anything(),
    );

    vi.unstubAllGlobals();
  });

  it("getSeriesById retorna null quando a TMDB responde 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSeriesById(env, 999999999);

    expect(result).toBeNull();

    vi.unstubAllGlobals();
  });

  it("getSeriesSeason devolve os episódios da temporada", async () => {
    const seasonDetail = {
      season_number: 1,
      episodes: [
        { episode_number: 1, name: "Pilot", air_date: "2008-01-20", still_path: "/still-1.jpg" },
        {
          episode_number: 2,
          name: "Cat's in the Bag...",
          air_date: "2008-01-27",
          still_path: null,
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(seasonDetail));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSeriesSeason(env, 1396, 1);

    expect(result).toEqual(seasonDetail);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.themoviedb.org/3/tv/1396/season/1",
      expect.anything(),
    );

    vi.unstubAllGlobals();
  });

  it("getSeriesSeason retorna null quando a TMDB responde 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSeriesSeason(env, 1396, 99);

    expect(result).toBeNull();

    vi.unstubAllGlobals();
  });
});

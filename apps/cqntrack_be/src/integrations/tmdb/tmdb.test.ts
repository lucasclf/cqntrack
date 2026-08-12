import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { getMovieById, searchMovies } from "./movies";
import { getSeriesById, getSeriesEpisode, getSeriesSeason, searchSeries } from "./series";

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

  it("getSeriesEpisode devolve o detalhe completo do episódio, com o crew (formato real capturado no planejamento)", async () => {
    const episodeDetail = {
      episode_number: 1,
      season_number: 1,
      name: "Pilot",
      overview: "Walter White, a New Mexico chemistry teacher, is diagnosed with cancer.",
      air_date: "2008-01-20",
      still_path: "/still-1.jpg",
      runtime: 58,
      vote_average: 8.2,
      crew: [
        {
          id: 66633,
          name: "Vince Gilligan",
          job: "Writer",
          department: "Writing",
          profile_path: "/gilligan.jpg",
        },
        {
          id: 66633,
          name: "Vince Gilligan",
          job: "Director",
          department: "Directing",
          profile_path: "/gilligan.jpg",
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(episodeDetail));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSeriesEpisode(env, 1396, 1, 1);

    expect(result).toEqual(episodeDetail);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.themoviedb.org/3/tv/1396/season/1/episode/1",
      expect.anything(),
    );

    vi.unstubAllGlobals();
  });

  it("getSeriesEpisode retorna null quando a TMDB responde 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSeriesEpisode(env, 1396, 1, 999);

    expect(result).toBeNull();

    vi.unstubAllGlobals();
  });

  it("busca filmes com Authorization: Bearer, sem etapa de token separada", async () => {
    const movieSearchResult = {
      id: 27205,
      title: "Inception",
      poster_path: "/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg",
      release_date: "2010-07-15",
      genre_ids: [28, 878],
      vote_average: 8.4,
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ results: [movieSearchResult] }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchMovies(env, "inception");

    expect(results).toEqual([movieSearchResult]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(
      "https://api.themoviedb.org/3/search/movie?query=inception&include_adult=false",
    );
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: expect.stringContaining("Bearer "),
    });

    vi.unstubAllGlobals();
  });

  it("getMovieById devolve o detalhe completo (com gêneros nomeados)", async () => {
    const movieDetail = {
      id: 27205,
      title: "Inception",
      poster_path: "/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg",
      release_date: "2010-07-15",
      overview: "Um ladrão que rouba segredos corporativos através do uso de tecnologia de sonhos.",
      genres: [
        { id: 28, name: "Action" },
        { id: 878, name: "Science Fiction" },
      ],
      runtime: 148,
      vote_average: 8.4,
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(movieDetail));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMovieById(env, 27205);

    expect(result).toEqual(movieDetail);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.themoviedb.org/3/movie/27205",
      expect.anything(),
    );

    vi.unstubAllGlobals();
  });

  it("getMovieById retorna null quando a TMDB responde 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMovieById(env, 999999999);

    expect(result).toBeNull();

    vi.unstubAllGlobals();
  });
});

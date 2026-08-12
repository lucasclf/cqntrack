import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import {
  getMovieCredits,
  getPersonById,
  getPersonMovieCredits,
  getPersonTvCredits,
  getSeriesAggregateCredits,
} from "./credits";

// Formato real capturado de GET /movie/27205/credits (Inception) durante o
// planejamento — reduzido a 2 do elenco + o diretor.
const MOVIE_CREDITS = {
  cast: [
    {
      id: 6193,
      name: "Leonardo DiCaprio",
      character: "Dom Cobb",
      profile_path: "/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg",
      order: 0,
    },
    {
      id: 24045,
      name: "Joseph Gordon-Levitt",
      character: "Arthur",
      profile_path: "/z2FA8js799xqtfiFjBTicFYdfk.jpg",
      order: 1,
    },
  ],
  crew: [
    {
      id: 559,
      name: "Wally Pfister",
      job: "Director of Photography",
      department: "Camera",
      profile_path: "/uyWeYsERTTLjpjkE79QeSETLIoA.jpg",
    },
    {
      id: 525,
      name: "Christopher Nolan",
      job: "Director",
      department: "Directing",
      profile_path: "/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg",
    },
  ],
};

// Formato real capturado de GET /tv/1396/aggregate_credits (Breaking Bad).
const SERIES_AGGREGATE_CREDITS = {
  cast: [
    {
      id: 17419,
      name: "Bryan Cranston",
      profile_path: "/npIIZJGSrcJIJ6yHdmbqO6Jzo5I.jpg",
      order: 0,
      roles: [{ character: "Walter White", episode_count: 62 }],
    },
  ],
  crew: [
    {
      id: 29779,
      name: "Michelle MacLaren",
      profile_path: "/3LcH5eNiysMWaepARllVrS4Dzn7.jpg",
      department: "Directing",
      jobs: [{ job: "Director", episode_count: 11 }],
    },
  ],
};

const PERSON_DETAIL = {
  id: 525,
  name: "Christopher Nolan",
  profile_path: "/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg",
  biography: "Sir Christopher Edward Nolan (born 30 July 1970) is a British and American filmmaker.",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("integrations/tmdb/credits", () => {
  it("getMovieCredits devolve cast e crew (com o diretor no meio do crew)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(MOVIE_CREDITS));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMovieCredits(env, 27205);

    expect(result).toEqual(MOVIE_CREDITS);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.themoviedb.org/3/movie/27205/credits",
      expect.anything(),
    );

    vi.unstubAllGlobals();
  });

  it("getMovieCredits retorna null quando a TMDB responde 404", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMovieCredits(env, 999999999);

    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it("getSeriesAggregateCredits devolve cast (com roles[]) e crew (com jobs[])", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(SERIES_AGGREGATE_CREDITS));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSeriesAggregateCredits(env, 1396);

    expect(result).toEqual(SERIES_AGGREGATE_CREDITS);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.themoviedb.org/3/tv/1396/aggregate_credits",
      expect.anything(),
    );

    vi.unstubAllGlobals();
  });

  it("getSeriesAggregateCredits retorna null quando a TMDB responde 404", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSeriesAggregateCredits(env, 999999999);

    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it("getPersonById devolve o detalhe completo", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(PERSON_DETAIL));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPersonById(env, 525);

    expect(result).toEqual(PERSON_DETAIL);
    expect(fetchMock).toHaveBeenCalledWith("https://api.themoviedb.org/3/person/525", expect.anything());

    vi.unstubAllGlobals();
  });

  it("getPersonById retorna null quando a TMDB responde 404", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ status_message: "not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPersonById(env, 999999999);

    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });

  it("getPersonMovieCredits devolve cast e crew no formato de filme (title/release_date)", async () => {
    const personMovieCredits = {
      cast: [],
      crew: [
        {
          id: 804706,
          title: "Tarantella",
          poster_path: "/eqFhruWEIRwjkvqgJN48VPuR50Q.jpg",
          release_date: "1990-09-12",
          department: "Directing",
          job: "Director",
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(personMovieCredits));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPersonMovieCredits(env, 525);

    expect(result).toEqual(personMovieCredits);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.themoviedb.org/3/person/525/movie_credits",
      expect.anything(),
    );

    vi.unstubAllGlobals();
  });

  it("getPersonTvCredits devolve cast e crew no formato de série (name/first_air_date)", async () => {
    const personTvCredits = {
      cast: [
        {
          id: 93,
          name: "Falcon Crest",
          poster_path: "/rgcKhBsHwAlPpeJG9yKip5oWVo9.jpg",
          first_air_date: "1981-12-04",
          character: "Martin Randall",
        },
      ],
      crew: [
        {
          id: 1396,
          name: "Breaking Bad",
          poster_path: "/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg",
          first_air_date: "2008-01-20",
          department: "Creator",
          job: "Creator",
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(personTvCredits));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPersonTvCredits(env, 66633);

    expect(result).toEqual(personTvCredits);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.themoviedb.org/3/person/66633/tv_credits",
      expect.anything(),
    );

    vi.unstubAllGlobals();
  });
});

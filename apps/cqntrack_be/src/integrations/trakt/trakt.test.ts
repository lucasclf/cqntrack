import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMovieRatings,
  getShowRatings,
  getWatchedMovies,
  getWatchedShows,
  toCqntrackRating,
} from "./client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("integrations/trakt", () => {
  it("getWatchedMovies manda os headers exigidos pela Trakt e devolve o corpo", async () => {
    const movies = [
      {
        plays: 2,
        last_watched_at: "2026-01-01T00:00:00Z",
        movie: { title: "A", ids: { trakt: 1, tmdb: 27205 } },
      },
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(movies));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getWatchedMovies(env, "alguem");

    expect(result).toEqual(movies);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe("https://api.trakt.tv/users/alguem/watched/movies");
    expect((init as RequestInit).headers).toMatchObject({
      "trakt-api-version": "2",
      "trakt-api-key": env.TRAKT_CLIENT_ID,
      "Content-Type": "application/json",
    });
  });

  it("getWatchedShows codifica o username na URL", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await getWatchedShows(env, "alguém com espaço");

    const [url] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(
      "https://api.trakt.tv/users/algu%C3%A9m%20com%20espa%C3%A7o/watched/shows",
    );
  });

  it("getMovieRatings e getShowRatings devolvem o corpo em caso de sucesso", async () => {
    const ratings = [
      {
        rated_at: "2026-01-01T00:00:00Z",
        rating: 8,
        movie: { title: "A", ids: { trakt: 1, tmdb: 27205 } },
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(ratings)));
    await expect(getMovieRatings(env, "alguem")).resolves.toEqual(ratings);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse([])));
    await expect(getShowRatings(env, "alguem")).resolves.toEqual([]);
  });

  it.each([401, 403, 404])(
    "status %i (perfil privado/inexistente) devolve null, não lança",
    async (status) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status })));

      await expect(getWatchedMovies(env, "privado")).resolves.toBeNull();
    },
  );

  it("outros erros (ex.: 500) lançam TraktRequestError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("fora do ar", { status: 500 })),
    );

    await expect(getWatchedMovies(env, "alguem")).rejects.toThrow(
      /Requisição ao Trakt falhou \(status 500\)/,
    );
  });

  it("toCqntrackRating converte a escala 1-10 do Trakt pra 0-5 em meio-ponto", () => {
    expect(toCqntrackRating(10)).toBe(5);
    expect(toCqntrackRating(8)).toBe(4);
    expect(toCqntrackRating(7)).toBe(3.5);
    expect(toCqntrackRating(1)).toBe(0.5);
  });
});

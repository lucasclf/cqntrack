import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb } from "../../db/client";
import { igdbToken } from "../../db/schema";
import { getGameById, searchGames } from "./games";
import { resetRateLimiter } from "./rate-limiter";
import { resetIgdbTokenMemoryCache } from "./token";

const TOKEN_RESPONSE = { access_token: "fake-token", expires_in: 3600 };
const GAME: {
  id: number;
  name: string;
  slug: string;
  cover: { image_id: string };
  total_rating: number;
} = {
  id: 1942,
  name: "The Witcher 3: Wild Hunt",
  slug: "the-witcher-3-wild-hunt",
  cover: { image_id: "abc123" },
  total_rating: 93.5,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("integrations/igdb", () => {
  const db = createDb(env);

  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    // O D1 de teste não isola dados entre `it()` do mesmo arquivo — sem isso,
    // o token cacheado por um teste anterior seria reaproveitado aqui.
    await db.delete(igdbToken);
  });

  it("busca o token OAuth na Twitch e depois consulta a IGDB", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(jsonResponse([GAME]));
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchGames(env, db, "witcher");

    expect(results).toEqual([GAME]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain("id.twitch.tv/oauth2/token");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.igdb.com/v4/games");

    vi.unstubAllGlobals();
  });

  it("reaproveita o token em memória em chamadas subsequentes (não busca token de novo)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(jsonResponse([GAME]))
      .mockResolvedValueOnce(jsonResponse([GAME]));
    vi.stubGlobal("fetch", fetchMock);

    await searchGames(env, db, "witcher");
    await searchGames(env, db, "witcher 3");

    // 1 chamada de token + 2 buscas = 3, não 4.
    expect(fetchMock).toHaveBeenCalledTimes(3);

    vi.unstubAllGlobals();
  });

  it("renova o token quando a IGDB responde 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(jsonResponse({ message: "invalid token" }, 401))
      .mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(jsonResponse([GAME]));
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchGames(env, db, "witcher");

    expect(results).toEqual([GAME]);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    vi.unstubAllGlobals();
  });

  it("getGameById retorna null quando a IGDB não encontra o jogo", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGameById(env, db, 999999);

    expect(result).toBeNull();

    vi.unstubAllGlobals();
  });
});

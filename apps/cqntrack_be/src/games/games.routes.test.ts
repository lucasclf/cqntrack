import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { igdbToken } from "../db/schema";
import { createDb } from "../db/client";
import { resetRateLimiter } from "../integrations/igdb/rate-limiter";
import { resetIgdbTokenMemoryCache } from "../integrations/igdb/token";

const TOKEN_RESPONSE = { access_token: "fake-token", expires_in: 3600 };
const IGDB_GAME = {
  id: 1942,
  name: "The Witcher 3: Wild Hunt",
  slug: "the-witcher-3-wild-hunt",
  cover: { image_id: "coaarl" },
  first_release_date: 1431993600,
  platforms: [{ name: "PC (Microsoft Windows)" }],
  genres: [{ name: "Role-playing (RPG)" }],
  total_rating: 92.76,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/games/search", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/games/search?q=witcher", undefined, env);

    expect(res.status).toBe(401);
  });

  it("sem o parâmetro q retorna 400", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/games/search", { headers: { cookie } }, env);

    expect(res.status).toBe(400);
  });

  it("com sessão e query válida retorna os jogos mapeados para o DTO", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE))
        .mockResolvedValueOnce(jsonResponse([IGDB_GAME])),
    );

    const res = await app.request("/api/games/search?q=witcher", { headers: { cookie } }, env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      results: [
        {
          igdbId: 1942,
          name: "The Witcher 3: Wild Hunt",
          coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/coaarl.jpg",
          firstReleaseDate: "2015-05-19",
          platforms: ["PC (Microsoft Windows)"],
          genres: ["Role-playing (RPG)"],
          rating: 92.76,
        },
      ],
    });

    vi.unstubAllGlobals();
  });
});

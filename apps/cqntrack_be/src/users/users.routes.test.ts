import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { createDb } from "../db/client";
import { igdbToken } from "../db/schema";
import { resetRateLimiter } from "../integrations/igdb/rate-limiter";
import { resetIgdbTokenMemoryCache } from "../integrations/igdb/token";

const TOKEN_RESPONSE = { access_token: "fake-token", expires_in: 3600 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function igdbGame(id: number, name: string) {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    cover: { image_id: `cover-${id}` },
    first_release_date: 1431993600,
    summary: `Resumo do jogo ${id}`,
    platforms: [{ name: "PC (Microsoft Windows)" }],
    genres: [{ name: "Adventure" }],
    total_rating: 88,
  };
}

function stubIgdbFetchOnce(...gameResponses: unknown[][]): void {
  const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE));
  for (const games of gameResponses) {
    fetchMock.mockResolvedValueOnce(jsonResponse(games));
  }
  vi.stubGlobal("fetch", fetchMock);
}

describe("/api/users", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("username inexistente retorna 404 em todas as sub-rotas", async () => {
    const profileRes = await app.request("/api/users/nao-existe", undefined, env);
    expect(profileRes.status).toBe(404);

    const entriesRes = await app.request("/api/users/nao-existe/entries", undefined, env);
    expect(entriesRes.status).toBe(404);

    const listsRes = await app.request("/api/users/nao-existe/lists", undefined, env);
    expect(listsRes.status).toBe(404);
  });

  it("devolve o perfil e as estatísticas zeradas sem exigir sessão", async () => {
    const { username } = await createAuthenticatedUser(app, env);

    const res = await app.request(`/api/users/${username}`, undefined, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { username: string; stats: Record<string, number> };
    expect(body.username).toBe(username);
    expect(body.stats).toEqual({ total: 0, completed: 0, playing: 0, platinum: 0, favorites: 0 });
  });

  it("lista as marcações e as listas públicas do usuário", async () => {
    const { cookie, username } = await createAuthenticatedUser(app, env);

    stubIgdbFetchOnce([igdbGame(701, "Hollow Knight")]);
    await app.request(
      "/api/games/701/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", favorite: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const createListRes = await app.request(
      "/api/lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Platinados" }),
      },
      env,
    );
    const { id: listId } = (await createListRes.json()) as { id: string };

    const profileRes = await app.request(`/api/users/${username}`, undefined, env);
    const profile = (await profileRes.json()) as { stats: Record<string, number> };
    expect(profile.stats).toEqual({ total: 1, completed: 1, playing: 0, platinum: 0, favorites: 1 });

    const entriesRes = await app.request(`/api/users/${username}/entries`, undefined, env);
    expect(entriesRes.status).toBe(200);
    const entriesBody = (await entriesRes.json()) as { items: Array<{ game: { igdbId: number } }> };
    expect(entriesBody.items).toEqual([expect.objectContaining({ game: expect.objectContaining({ igdbId: 701 }) })]);

    const listsRes = await app.request(`/api/users/${username}/lists`, undefined, env);
    expect(listsRes.status).toBe(200);
    const listsBody = (await listsRes.json()) as { lists: Array<{ id: string; name: string }> };
    expect(listsBody.lists).toEqual([expect.objectContaining({ id: listId, name: "Platinados" })]);

    const listDetailRes = await app.request(`/api/users/${username}/lists/${listId}`, undefined, env);
    expect(listDetailRes.status).toBe(200);

    const otherUserListDetailRes = await app.request(
      `/api/users/${username}/lists/id-que-nao-existe`,
      undefined,
      env,
    );
    expect(otherUserListDetailRes.status).toBe(404);
  });
});

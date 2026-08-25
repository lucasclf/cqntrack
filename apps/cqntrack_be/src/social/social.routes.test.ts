import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { createDb } from "../db/client";
import { igdbToken, user } from "../db/schema";
import { resetRateLimiter } from "../integrations/igdb/rate-limiter";
import { resetIgdbTokenMemoryCache } from "../integrations/igdb/token";

// Mesmo mecanismo de createAuthenticatedUser (test/auth-helpers.ts), só que
// com username controlado — necessário pros testes de busca por substring,
// onde o sufixo aleatório do helper genérico não dá pra prever.
async function signUpUserWithUsername(username: string): Promise<{ cookie: string }> {
  const email = `teste-${crypto.randomUUID()}@cqntrack.dev`;
  const password = "senha12345";

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  await app.request(
    "/api/auth/sign-up/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Teste", username, email, password }),
    },
    env,
  );
  vi.unstubAllGlobals();

  await createDb(env).update(user).set({ emailVerified: true }).where(eq(user.email, email));

  const signInRes = await app.request(
    "/api/auth/sign-in/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    env,
  );
  const setCookie = signInRes.headers.get("set-cookie");
  const [cookie] = setCookie?.split(";") ?? [];
  if (!cookie) {
    throw new Error("Falha ao criar usuário de teste: resposta não trouxe Set-Cookie");
  }
  return { cookie };
}

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

const TOKEN_RESPONSE = { access_token: "fake-token", expires_in: 3600 };

function stubIgdbFetchOnce(...gameResponses: unknown[][]): void {
  const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE));
  for (const games of gameResponses) {
    fetchMock.mockResolvedValueOnce(jsonResponse(games));
  }
  vi.stubGlobal("fetch", fetchMock);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function markGamePlaying(cookie: string, igdbId: number): Promise<void> {
  await app.request(
    `/api/games/${igdbId}/entry`,
    {
      method: "PUT",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "playing" }),
    },
    env,
  );
}

describe("/api/social", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("sem sessão retorna 401 em todas as rotas", async () => {
    expect((await app.request("/api/social/follow/alguem", undefined, env)).status).toBe(401);
    expect((await app.request("/api/social/follow/alguem", { method: "PUT" }, env)).status).toBe(
      401,
    );
    expect((await app.request("/api/social/follow/alguem", { method: "DELETE" }, env)).status).toBe(
      401,
    );
    expect((await app.request("/api/social/follow/alguem/status", undefined, env)).status).toBe(
      401,
    );
    expect((await app.request("/api/social/following", undefined, env)).status).toBe(401);
    expect((await app.request("/api/social/feed", undefined, env)).status).toBe(401);
    expect((await app.request("/api/social/search", undefined, env)).status).toBe(401);
  });

  it("PUT /follow/:username — 404 pra username inexistente", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request(
      "/api/social/follow/usuario-que-nao-existe",
      { method: "PUT", headers: { cookie } },
      env,
    );

    expect(res.status).toBe(404);
  });

  it("PUT /follow/:username — 400 ao tentar seguir a si mesmo", async () => {
    const { cookie, username } = await createAuthenticatedUser(app, env);

    const res = await app.request(
      `/api/social/follow/${username}`,
      { method: "PUT", headers: { cookie } },
      env,
    );

    expect(res.status).toBe(400);
  });

  it("PUT /follow/:username — 204 e idempotente (seguir 2x não duplica)", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const { username: targetUsername } = await createAuthenticatedUser(app, env);

    const first = await app.request(
      `/api/social/follow/${targetUsername}`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    const second = await app.request(
      `/api/social/follow/${targetUsername}`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    expect(first.status).toBe(204);
    expect(second.status).toBe(204);

    const followingRes = await app.request("/api/social/following", { headers: { cookie } }, env);
    const followingBody = (await followingRes.json()) as { items: unknown[] };
    expect(followingBody.items).toHaveLength(1);
  });

  it("DELETE /follow/:username — 204 idempotente e remove de fato", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const { username: targetUsername } = await createAuthenticatedUser(app, env);

    // Sem seguir antes — idempotente, não é erro.
    const withoutFollow = await app.request(
      `/api/social/follow/${targetUsername}`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(withoutFollow.status).toBe(204);

    await app.request(
      `/api/social/follow/${targetUsername}`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    const unfollowRes = await app.request(
      `/api/social/follow/${targetUsername}`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(unfollowRes.status).toBe(204);

    const followingRes = await app.request("/api/social/following", { headers: { cookie } }, env);
    const followingBody = (await followingRes.json()) as { items: unknown[] };
    expect(followingBody.items).toHaveLength(0);
  });

  it("GET /follow/:username/status — false antes de seguir, true depois", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const { username: targetUsername } = await createAuthenticatedUser(app, env);

    const before = await app.request(
      `/api/social/follow/${targetUsername}/status`,
      { headers: { cookie } },
      env,
    );
    expect((await before.json()) as { following: boolean }).toEqual({ following: false });

    await app.request(
      `/api/social/follow/${targetUsername}`,
      { method: "PUT", headers: { cookie } },
      env,
    );

    const after = await app.request(
      `/api/social/follow/${targetUsername}/status`,
      { headers: { cookie } },
      env,
    );
    expect((await after.json()) as { following: boolean }).toEqual({ following: true });
  });

  it("GET /following — ordenado mais recente primeiro, shape correto, sem vazar email", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const { username: firstUsername } = await createAuthenticatedUser(app, env);
    const { username: secondUsername } = await createAuthenticatedUser(app, env);

    await app.request(
      `/api/social/follow/${firstUsername}`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    await sleep(5);
    await app.request(
      `/api/social/follow/${secondUsername}`,
      { method: "PUT", headers: { cookie } },
      env,
    );

    const res = await app.request("/api/social/following", { headers: { cookie } }, env);
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };

    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.username).toBe(secondUsername);
    expect(body.items[1]?.username).toBe(firstUsername);
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(["displayUsername", "image", "username"]);
      expect(item).not.toHaveProperty("email");
    }
  });

  it("GET /feed — só mostra atividade de quem eu sigo, com o autor certo", async () => {
    const { cookie: cookieA } = await createAuthenticatedUser(app, env);
    const { cookie: cookieB, username: usernameB } = await createAuthenticatedUser(app, env);
    const { cookie: cookieC } = await createAuthenticatedUser(app, env);

    // Vazio antes de seguir ninguém.
    const emptyRes = await app.request("/api/social/feed", { headers: { cookie: cookieA } }, env);
    const emptyBody = (await emptyRes.json()) as { items: unknown[] };
    expect(emptyBody.items).toHaveLength(0);

    await app.request(
      `/api/social/follow/${usernameB}`,
      { method: "PUT", headers: { cookie: cookieA } },
      env,
    );

    stubIgdbFetchOnce([igdbGame(921, "Jogo de B")]);
    await markGamePlaying(cookieB, 921);
    vi.unstubAllGlobals();

    // C não é seguido — a atividade dele nunca deve aparecer no feed de A.
    stubIgdbFetchOnce([igdbGame(922, "Jogo de C")]);
    await markGamePlaying(cookieC, 922);
    vi.unstubAllGlobals();

    const res = await app.request("/api/social/feed", { headers: { cookie: cookieA } }, env);
    const body = (await res.json()) as {
      items: Array<{ itemId: string; author: { username: string } }>;
    };

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.itemId).toBe("921");
    expect(body.items[0]?.author.username).toBe(usernameB);
  });

  it("GET /feed — pagina por cursor sem duplicar nem perder itens", async () => {
    const { cookie: cookieA } = await createAuthenticatedUser(app, env);
    const { cookie: cookieB, username: usernameB } = await createAuthenticatedUser(app, env);

    await app.request(
      `/api/social/follow/${usernameB}`,
      { method: "PUT", headers: { cookie: cookieA } },
      env,
    );

    stubIgdbFetchOnce(
      [igdbGame(931, "Jogo 1")],
      [igdbGame(932, "Jogo 2")],
      [igdbGame(933, "Jogo 3")],
    );
    await markGamePlaying(cookieB, 931);
    await sleep(5);
    await markGamePlaying(cookieB, 932);
    await sleep(5);
    await markGamePlaying(cookieB, 933);
    vi.unstubAllGlobals();

    const firstPageRes = await app.request(
      "/api/social/feed?limit=2",
      { headers: { cookie: cookieA } },
      env,
    );
    const firstPage = (await firstPageRes.json()) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPageRes = await app.request(
      `/api/social/feed?limit=2&before=${encodeURIComponent(firstPage.nextCursor!)}`,
      { headers: { cookie: cookieA } },
      env,
    );
    const secondPage = (await secondPageRes.json()) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();

    const allIds = [...firstPage.items, ...secondPage.items].map((item) => item.id);
    expect(new Set(allIds).size).toBe(3);
  });

  it("GET /feed — filtra por mediaType", async () => {
    const { cookie: cookieA } = await createAuthenticatedUser(app, env);
    const { cookie: cookieB, username: usernameB } = await createAuthenticatedUser(app, env);

    await app.request(
      `/api/social/follow/${usernameB}`,
      { method: "PUT", headers: { cookie: cookieA } },
      env,
    );

    stubIgdbFetchOnce([igdbGame(941, "Jogo filtrado")]);
    await markGamePlaying(cookieB, 941);
    vi.unstubAllGlobals();

    const gamesRes = await app.request(
      "/api/social/feed?mediaType=games",
      { headers: { cookie: cookieA } },
      env,
    );
    const gamesBody = (await gamesRes.json()) as { items: Array<{ mediaType: string }> };
    expect(gamesBody.items).toHaveLength(1);

    const moviesRes = await app.request(
      "/api/social/feed?mediaType=movies",
      { headers: { cookie: cookieA } },
      env,
    );
    const moviesBody = (await moviesRes.json()) as { items: unknown[] };
    expect(moviesBody.items).toHaveLength(0);
  });

  it("GET /search — busca por substring (case-insensitive), sem vazar email, sem incluir o próprio viewer", async () => {
    const { cookie: viewerCookie, username: viewerUsername } = await createAuthenticatedUser(
      app,
      env,
    );
    const tag = crypto.randomUUID().slice(0, 8);
    await signUpUserWithUsername(`alice_${tag}`);
    await signUpUserWithUsername(`bob_${tag}`);

    const res = await app.request(
      `/api/social/search?q=${encodeURIComponent(`ALICE_${tag}`)}`,
      { headers: { cookie: viewerCookie } },
      env,
    );
    const body = (await res.json()) as {
      items: Array<Record<string, unknown>>;
      page: number;
      pageSize: number;
      total: number;
    };

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.username).toBe(`alice_${tag}`);
    expect(body.items.some((item) => item.username === viewerUsername)).toBe(false);
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(["displayUsername", "image", "username"]);
      expect(item).not.toHaveProperty("email");
    }
  });

  it("GET /search — sem q, devolve outros usuários (nunca o próprio viewer)", async () => {
    const { cookie: viewerCookie, username: viewerUsername } = await createAuthenticatedUser(
      app,
      env,
    );
    const tag = crypto.randomUUID().slice(0, 8);
    await signUpUserWithUsername(`carol_${tag}`);

    const res = await app.request(
      "/api/social/search?pageSize=50",
      { headers: { cookie: viewerCookie } },
      env,
    );
    const body = (await res.json()) as { items: Array<{ username: string }>; total: number };

    expect(body.items.some((item) => item.username === `carol_${tag}`)).toBe(true);
    expect(body.items.some((item) => item.username === viewerUsername)).toBe(false);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it("GET /search — pagina corretamente", async () => {
    const { cookie: viewerCookie } = await createAuthenticatedUser(app, env);
    const tag = crypto.randomUUID().slice(0, 8);
    await signUpUserWithUsername(`dave_${tag}`);
    await signUpUserWithUsername(`erin_${tag}`);

    const firstPageRes = await app.request(
      `/api/social/search?q=${encodeURIComponent(tag)}&page=1&pageSize=1`,
      { headers: { cookie: viewerCookie } },
      env,
    );
    const firstPage = (await firstPageRes.json()) as {
      items: Array<{ username: string }>;
      total: number;
    };
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.total).toBe(2);

    const secondPageRes = await app.request(
      `/api/social/search?q=${encodeURIComponent(tag)}&page=2&pageSize=1`,
      { headers: { cookie: viewerCookie } },
      env,
    );
    const secondPage = (await secondPageRes.json()) as { items: Array<{ username: string }> };
    expect(secondPage.items).toHaveLength(1);

    expect(firstPage.items[0]?.username).not.toBe(secondPage.items[0]?.username);
  });
});

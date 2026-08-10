import type { GameList, GameListDetail, GameListsResponse } from "@cqntrack/shared";
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

describe("/api/lists", () => {
  beforeEach(async () => {
    resetIgdbTokenMemoryCache();
    resetRateLimiter();
    await createDb(env).delete(igdbToken);
  });

  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/lists", undefined, env);

    expect(res.status).toBe(401);
  });

  it("cria uma lista e ela aparece na listagem", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const createRes = await app.request(
      "/api/lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Quero jogar", description: "Backlog" }),
      },
      env,
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created).toMatchObject({ name: "Quero jogar", description: "Backlog", itemCount: 0 });

    const listRes = await app.request("/api/lists", { headers: { cookie } }, env);
    const body = (await listRes.json()) as GameListsResponse;
    expect(body.lists).toHaveLength(1);
  });

  it("nome de lista duplicado retorna 409", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const create = () =>
      app.request(
        "/api/lists",
        {
          method: "POST",
          headers: { cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Odiei" }),
        },
        env,
      );

    const first = await create();
    expect(first.status).toBe(201);

    const second = await create();
    expect(second.status).toBe(409);
  });

  it("lista inexistente (ou de outro usuário) retorna 404", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const res = await app.request("/api/lists/id-que-nao-existe", { headers: { cookie } }, env);

    expect(res.status).toBe(404);
  });

  it("adiciona e remove um jogo da lista, refletindo no itemCount e nos items", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Jogado em 2026" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as GameList;

    stubIgdbFetchOnce([igdbGame(801, "Hades")]);
    const addRes = await app.request(
      `/api/lists/${listId}/items/801`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    expect(addRes.status).toBe(204);
    vi.unstubAllGlobals();

    const detailRes = await app.request(`/api/lists/${listId}`, { headers: { cookie } }, env);
    const detail = (await detailRes.json()) as GameListDetail;
    expect(detail.itemCount).toBe(1);
    expect(detail.items).toEqual([expect.objectContaining({ igdbId: 801, name: "Hades" })]);

    const removeRes = await app.request(
      `/api/lists/${listId}/items/801`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(removeRes.status).toBe(204);

    const afterRemoveRes = await app.request(`/api/lists/${listId}`, { headers: { cookie } }, env);
    const afterRemove = (await afterRemoveRes.json()) as GameListDetail;
    expect(afterRemove.itemCount).toBe(0);
  });

  it("adicionar o mesmo jogo duas vezes não gera atividade duplicada", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Favoritos de sempre" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as GameList;

    stubIgdbFetchOnce([igdbGame(802, "Celeste")]);
    await app.request(`/api/lists/${listId}/items/802`, { method: "PUT", headers: { cookie } }, env);
    vi.unstubAllGlobals();

    const throwingFetch = vi.fn().mockRejectedValue(new Error("não deveria chamar a IGDB de novo"));
    vi.stubGlobal("fetch", throwingFetch);
    const secondAddRes = await app.request(
      `/api/lists/${listId}/items/802`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    expect(secondAddRes.status).toBe(204);
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const addedToList = activities.filter(
      (item) => item.type === "added_to_list" && item.itemId === "802",
    );
    expect(addedToList).toHaveLength(1);
  });

  it("PATCH atualiza nome/descrição da lista", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nome antigo" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as GameList;

    const patchRes = await app.request(
      `/api/lists/${listId}`,
      {
        method: "PATCH",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nome novo" }),
      },
      env,
    );

    expect(patchRes.status).toBe(200);
    const body = (await patchRes.json()) as GameList;
    expect(body.name).toBe("Nome novo");
  });

  it("DELETE remove a lista", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lista temporária" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as GameList;

    const deleteRes = await app.request(
      `/api/lists/${listId}`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(deleteRes.status).toBe(204);

    const getRes = await app.request(`/api/lists/${listId}`, { headers: { cookie } }, env);
    expect(getRes.status).toBe(404);
  });
});

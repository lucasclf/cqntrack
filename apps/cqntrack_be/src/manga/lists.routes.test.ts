import type { MangaList, MangaListDetail, MangaListsResponse } from "@cqntrack/shared";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { createAuthenticatedUser } from "../../test/auth-helpers";
import { app } from "../app";
import { createDb } from "../db/client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mangadexManga(id: string, title: string) {
  return {
    id,
    attributes: {
      title: { en: title },
      altTitles: [],
      description: { en: `Sinopse de ${title}` },
      status: "ongoing",
      contentRating: "safe",
      year: 2020,
      tags: [],
    },
    relationships: [{ id: "autor-1", type: "author", attributes: { name: "Autor de Teste" } }],
  };
}

function stubMangadexFetchOnce(...responses: unknown[]): void {
  const fetchMock = vi.fn();
  for (const body of responses) {
    fetchMock.mockResolvedValueOnce(jsonResponse(body));
  }
  vi.stubGlobal("fetch", fetchMock);
}

describe("/api/manga-lists", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/manga-lists", undefined, env);
    expect(res.status).toBe(401);
  });

  it("cria uma lista e ela aparece na listagem", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const createRes = await app.request(
      "/api/manga-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Quero ler", description: "Backlog" }),
      },
      env,
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created).toMatchObject({ name: "Quero ler", description: "Backlog", itemCount: 0 });

    const listRes = await app.request("/api/manga-lists", { headers: { cookie } }, env);
    const body = (await listRes.json()) as MangaListsResponse;
    expect(body.lists).toHaveLength(1);
  });

  it("nome de lista duplicado retorna 409", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const create = () =>
      app.request(
        "/api/manga-lists",
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

    const res = await app.request(
      "/api/manga-lists/id-que-nao-existe",
      { headers: { cookie } },
      env,
    );

    expect(res.status).toBe(404);
  });

  it("adiciona e remove um mangá da lista, refletindo no itemCount e nos items", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/manga-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lidos em 2026" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as MangaList;

    stubMangadexFetchOnce({ data: mangadexManga("manga-801", "Parasita") });
    const addRes = await app.request(
      `/api/manga-lists/${listId}/items/manga-801`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    expect(addRes.status).toBe(204);
    vi.unstubAllGlobals();

    const detailRes = await app.request(`/api/manga-lists/${listId}`, { headers: { cookie } }, env);
    const detail = (await detailRes.json()) as MangaListDetail;
    expect(detail.itemCount).toBe(1);
    expect(detail.items).toEqual([
      expect.objectContaining({ mangadexId: "manga-801", title: "Parasita" }),
    ]);

    const removeRes = await app.request(
      `/api/manga-lists/${listId}/items/manga-801`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(removeRes.status).toBe(204);

    const afterRemoveRes = await app.request(
      `/api/manga-lists/${listId}`,
      { headers: { cookie } },
      env,
    );
    const afterRemove = (await afterRemoveRes.json()) as MangaListDetail;
    expect(afterRemove.itemCount).toBe(0);
  });

  it("adicionar o mesmo mangá duas vezes não gera atividade duplicada", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/manga-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Favoritos de sempre" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as MangaList;

    stubMangadexFetchOnce({ data: mangadexManga("manga-802", "Uísque") });
    await app.request(
      `/api/manga-lists/${listId}/items/manga-802`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    vi.unstubAllGlobals();

    const throwingFetch = vi
      .fn()
      .mockRejectedValue(new Error("não deveria chamar a MangaDex de novo"));
    vi.stubGlobal("fetch", throwingFetch);
    const secondAddRes = await app.request(
      `/api/manga-lists/${listId}/items/manga-802`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    expect(secondAddRes.status).toBe(204);
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const addedToList = activities.filter(
      (item) => item.type === "added_to_list" && item.itemId === "manga-802",
    );
    expect(addedToList).toHaveLength(1);
  });

  it("PATCH atualiza nome/descrição da lista", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/manga-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nome antigo" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as MangaList;

    const patchRes = await app.request(
      `/api/manga-lists/${listId}`,
      {
        method: "PATCH",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nome novo" }),
      },
      env,
    );

    expect(patchRes.status).toBe(200);
    const body = (await patchRes.json()) as MangaList;
    expect(body.name).toBe("Nome novo");
  });

  it("DELETE remove a lista", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/manga-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lista temporária" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as MangaList;

    const deleteRes = await app.request(
      `/api/manga-lists/${listId}`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(deleteRes.status).toBe(204);

    const getRes = await app.request(`/api/manga-lists/${listId}`, { headers: { cookie } }, env);
    expect(getRes.status).toBe(404);
  });
});

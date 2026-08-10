import type { SeriesList, SeriesListDetail, SeriesListsResponse } from "@cqntrack/shared";
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

function tmdbSeriesDetail(id: number, name: string) {
  return {
    id,
    name,
    poster_path: `/poster-${id}.jpg`,
    first_air_date: "2008-01-20",
    overview: `Resumo da série ${id}`,
    genres: [{ id: 18, name: "Drama" }],
    number_of_seasons: 5,
    number_of_episodes: 62,
    vote_average: 8.9,
  };
}

// A TMDB não tem etapa de token (diferente da IGDB) — um fetch mockado por
// chamada é suficiente.
function stubTmdbFetchOnce(...responses: unknown[]): void {
  const fetchMock = vi.fn();
  for (const body of responses) {
    fetchMock.mockResolvedValueOnce(jsonResponse(body));
  }
  vi.stubGlobal("fetch", fetchMock);
}

describe("/api/series-lists", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/series-lists", undefined, env);

    expect(res.status).toBe(401);
  });

  it("cria uma lista e ela aparece na listagem", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const createRes = await app.request(
      "/api/series-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Quero assistir", description: "Backlog" }),
      },
      env,
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created).toMatchObject({ name: "Quero assistir", description: "Backlog", itemCount: 0 });

    const listRes = await app.request("/api/series-lists", { headers: { cookie } }, env);
    const body = (await listRes.json()) as SeriesListsResponse;
    expect(body.lists).toHaveLength(1);
  });

  it("nome de lista duplicado retorna 409", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const create = () =>
      app.request(
        "/api/series-lists",
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

    const res = await app.request("/api/series-lists/id-que-nao-existe", { headers: { cookie } }, env);

    expect(res.status).toBe(404);
  });

  it("adiciona e remove uma série da lista, refletindo no itemCount e nos items", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/series-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Assistido em 2026" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as SeriesList;

    stubTmdbFetchOnce(tmdbSeriesDetail(801, "Dark"));
    const addRes = await app.request(
      `/api/series-lists/${listId}/items/801`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    expect(addRes.status).toBe(204);
    vi.unstubAllGlobals();

    const detailRes = await app.request(`/api/series-lists/${listId}`, { headers: { cookie } }, env);
    const detail = (await detailRes.json()) as SeriesListDetail;
    expect(detail.itemCount).toBe(1);
    expect(detail.items).toEqual([expect.objectContaining({ tmdbId: 801, name: "Dark" })]);

    const removeRes = await app.request(
      `/api/series-lists/${listId}/items/801`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(removeRes.status).toBe(204);

    const afterRemoveRes = await app.request(`/api/series-lists/${listId}`, { headers: { cookie } }, env);
    const afterRemove = (await afterRemoveRes.json()) as SeriesListDetail;
    expect(afterRemove.itemCount).toBe(0);
  });

  it("adicionar a mesma série duas vezes não gera atividade duplicada", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/series-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Favoritas de sempre" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as SeriesList;

    stubTmdbFetchOnce(tmdbSeriesDetail(802, "The Wire"));
    await app.request(`/api/series-lists/${listId}/items/802`, { method: "PUT", headers: { cookie } }, env);
    vi.unstubAllGlobals();

    const throwingFetch = vi.fn().mockRejectedValue(new Error("não deveria chamar a TMDB de novo"));
    vi.stubGlobal("fetch", throwingFetch);
    const secondAddRes = await app.request(
      `/api/series-lists/${listId}/items/802`,
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
      "/api/series-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nome antigo" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as SeriesList;

    const patchRes = await app.request(
      `/api/series-lists/${listId}`,
      {
        method: "PATCH",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nome novo" }),
      },
      env,
    );

    expect(patchRes.status).toBe(200);
    const body = (await patchRes.json()) as SeriesList;
    expect(body.name).toBe("Nome novo");
  });

  it("DELETE remove a lista", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/series-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lista temporária" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as SeriesList;

    const deleteRes = await app.request(
      `/api/series-lists/${listId}`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(deleteRes.status).toBe(204);

    const getRes = await app.request(`/api/series-lists/${listId}`, { headers: { cookie } }, env);
    expect(getRes.status).toBe(404);
  });
});

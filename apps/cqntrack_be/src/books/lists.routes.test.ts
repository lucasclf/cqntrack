import type { BookList, BookListDetail, BookListsResponse } from "@cqntrack/shared";
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

function googleBooksVolume(id: string, title: string) {
  return {
    id,
    volumeInfo: {
      title,
      authors: ["Autor de Teste"],
      publishedDate: "2010-07-15",
      description: `Sinopse de ${title}`,
      categories: ["Fiction"],
      pageCount: 320,
      imageLinks: { thumbnail: `http://books.google.com/books/content?id=${id}` },
      averageRating: 4.5,
    },
  };
}

// A Google Books não tem etapa de token (diferente da IGDB) — um fetch
// mockado por chamada é suficiente.
function stubGoogleBooksFetchOnce(...responses: unknown[]): void {
  const fetchMock = vi.fn();
  for (const body of responses) {
    fetchMock.mockResolvedValueOnce(jsonResponse(body));
  }
  vi.stubGlobal("fetch", fetchMock);
}

describe("/api/books-lists", () => {
  it("sem sessão retorna 401", async () => {
    const res = await app.request("/api/books-lists", undefined, env);

    expect(res.status).toBe(401);
  });

  it("cria uma lista e ela aparece na listagem", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);

    const createRes = await app.request(
      "/api/books-lists",
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

    const listRes = await app.request("/api/books-lists", { headers: { cookie } }, env);
    const body = (await listRes.json()) as BookListsResponse;
    expect(body.lists).toHaveLength(1);
  });

  it("nome de lista duplicado retorna 409", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const create = () =>
      app.request(
        "/api/books-lists",
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
      "/api/books-lists/id-que-nao-existe",
      { headers: { cookie } },
      env,
    );

    expect(res.status).toBe(404);
  });

  it("adiciona e remove um livro da lista, refletindo no itemCount e nos items", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/books-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lidos em 2026" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as BookList;

    stubGoogleBooksFetchOnce(googleBooksVolume("book-801", "Parasita"));
    const addRes = await app.request(
      `/api/books-lists/${listId}/items/book-801`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    expect(addRes.status).toBe(204);
    vi.unstubAllGlobals();

    const detailRes = await app.request(`/api/books-lists/${listId}`, { headers: { cookie } }, env);
    const detail = (await detailRes.json()) as BookListDetail;
    expect(detail.itemCount).toBe(1);
    expect(detail.items).toEqual([
      expect.objectContaining({ googleBooksId: "book-801", title: "Parasita" }),
    ]);

    const removeRes = await app.request(
      `/api/books-lists/${listId}/items/book-801`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(removeRes.status).toBe(204);

    const afterRemoveRes = await app.request(
      `/api/books-lists/${listId}`,
      { headers: { cookie } },
      env,
    );
    const afterRemove = (await afterRemoveRes.json()) as BookListDetail;
    expect(afterRemove.itemCount).toBe(0);
  });

  it("adicionar o mesmo livro duas vezes não gera atividade duplicada", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/books-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Favoritos de sempre" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as BookList;

    stubGoogleBooksFetchOnce(googleBooksVolume("book-802", "Uísque"));
    await app.request(
      `/api/books-lists/${listId}/items/book-802`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    vi.unstubAllGlobals();

    const throwingFetch = vi
      .fn()
      .mockRejectedValue(new Error("não deveria chamar a Google Books de novo"));
    vi.stubGlobal("fetch", throwingFetch);
    const secondAddRes = await app.request(
      `/api/books-lists/${listId}/items/book-802`,
      { method: "PUT", headers: { cookie } },
      env,
    );
    expect(secondAddRes.status).toBe(204);
    vi.unstubAllGlobals();

    const activities = await createDb(env).query.activity.findMany();
    const addedToList = activities.filter(
      (item) => item.type === "added_to_list" && item.itemId === "book-802",
    );
    expect(addedToList).toHaveLength(1);
  });

  it("PATCH atualiza nome/descrição da lista", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/books-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nome antigo" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as BookList;

    const patchRes = await app.request(
      `/api/books-lists/${listId}`,
      {
        method: "PATCH",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nome novo" }),
      },
      env,
    );

    expect(patchRes.status).toBe(200);
    const body = (await patchRes.json()) as BookList;
    expect(body.name).toBe("Nome novo");
  });

  it("DELETE remove a lista", async () => {
    const { cookie } = await createAuthenticatedUser(app, env);
    const createRes = await app.request(
      "/api/books-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lista temporária" }),
      },
      env,
    );
    const { id: listId } = (await createRes.json()) as BookList;

    const deleteRes = await app.request(
      `/api/books-lists/${listId}`,
      { method: "DELETE", headers: { cookie } },
      env,
    );
    expect(deleteRes.status).toBe(204);

    const getRes = await app.request(`/api/books-lists/${listId}`, { headers: { cookie } }, env);
    expect(getRes.status).toBe(404);
  });
});

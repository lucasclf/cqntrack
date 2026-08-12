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

  it("username inexistente retorna 404 em todas as sub-rotas, de jogos, séries, filmes e livros", async () => {
    const profileRes = await app.request("/api/users/nao-existe", undefined, env);
    expect(profileRes.status).toBe(404);

    const gameEntriesRes = await app.request("/api/users/nao-existe/games/entries", undefined, env);
    expect(gameEntriesRes.status).toBe(404);

    const gameListsRes = await app.request("/api/users/nao-existe/games/lists", undefined, env);
    expect(gameListsRes.status).toBe(404);

    const seriesEntriesRes = await app.request("/api/users/nao-existe/series/entries", undefined, env);
    expect(seriesEntriesRes.status).toBe(404);

    const seriesListsRes = await app.request("/api/users/nao-existe/series/lists", undefined, env);
    expect(seriesListsRes.status).toBe(404);

    const movieEntriesRes = await app.request("/api/users/nao-existe/movies/entries", undefined, env);
    expect(movieEntriesRes.status).toBe(404);

    const movieListsRes = await app.request("/api/users/nao-existe/movies/lists", undefined, env);
    expect(movieListsRes.status).toBe(404);

    const bookEntriesRes = await app.request("/api/users/nao-existe/books/entries", undefined, env);
    expect(bookEntriesRes.status).toBe(404);

    const bookListsRes = await app.request("/api/users/nao-existe/books/lists", undefined, env);
    expect(bookListsRes.status).toBe(404);
  });

  it("devolve o perfil sem exigir sessão", async () => {
    const { username } = await createAuthenticatedUser(app, env);

    const res = await app.request(`/api/users/${username}`, undefined, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { username: string; displayUsername: string; memberSince: string };
    expect(body.username).toBe(username);
    expect(body.memberSince).toEqual(expect.any(String));
  });

  it("lista as marcações e as listas públicas de jogos do usuário", async () => {
    const { cookie, username } = await createAuthenticatedUser(app, env);

    stubIgdbFetchOnce([igdbGame(701, "Hollow Knight")]);
    await app.request(
      "/api/games/701/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
      env,
    );
    await app.request(
      "/api/games/701/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
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

    const entriesRes = await app.request(`/api/users/${username}/games/entries`, undefined, env);
    expect(entriesRes.status).toBe(200);
    const entriesBody = (await entriesRes.json()) as { items: Array<{ game: { igdbId: number } }> };
    expect(entriesBody.items).toEqual([expect.objectContaining({ game: expect.objectContaining({ igdbId: 701 }) })]);

    const listsRes = await app.request(`/api/users/${username}/games/lists`, undefined, env);
    expect(listsRes.status).toBe(200);
    const listsBody = (await listsRes.json()) as { lists: Array<{ id: string; name: string }> };
    expect(listsBody.lists).toEqual([expect.objectContaining({ id: listId, name: "Platinados" })]);

    const listDetailRes = await app.request(`/api/users/${username}/games/lists/${listId}`, undefined, env);
    expect(listDetailRes.status).toBe(200);

    const otherUserListDetailRes = await app.request(
      `/api/users/${username}/games/lists/id-que-nao-existe`,
      undefined,
      env,
    );
    expect(otherUserListDetailRes.status).toBe(404);
  });

  it("devolve os favoritos de jogos, sem exigir sessão", async () => {
    const { cookie, username } = await createAuthenticatedUser(app, env);
    stubIgdbFetchOnce([igdbGame(702, "Celeste")]);
    await app.request(
      "/api/games/702/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const res = await app.request(`/api/users/${username}/games/favorites`, undefined, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ game: { igdbId: number } }> };
    expect(body.items).toEqual([expect.objectContaining({ game: expect.objectContaining({ igdbId: 702 }) })]);
  });

  it("lista as marcações, favoritos e listas públicas de séries do usuário", async () => {
    const { cookie, username } = await createAuthenticatedUser(app, env);

    const tmdbDetail = (id: number, name: string) => ({
      id,
      name,
      poster_path: `/poster-${id}.jpg`,
      first_air_date: "2008-01-20",
      overview: `Resumo da série ${id}`,
      genres: [{ id: 18, name: "Drama" }],
      number_of_seasons: 5,
      number_of_episodes: 62,
      vote_average: 8.9,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(tmdbDetail(1396, "Breaking Bad"))));
    await app.request(
      "/api/series/1396/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(tmdbDetail(1396, "Breaking Bad"))));
    await app.request(
      "/api/series/1396/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const createListRes = await app.request(
      "/api/series-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Maratonadas" }),
      },
      env,
    );
    const { id: listId } = (await createListRes.json()) as { id: string };

    const entriesRes = await app.request(`/api/users/${username}/series/entries`, undefined, env);
    expect(entriesRes.status).toBe(200);
    const entriesBody = (await entriesRes.json()) as { items: Array<{ series: { tmdbId: number } }> };
    expect(entriesBody.items).toEqual([
      expect.objectContaining({ series: expect.objectContaining({ tmdbId: 1396 }) }),
    ]);

    const favoritesRes = await app.request(`/api/users/${username}/series/favorites`, undefined, env);
    expect(favoritesRes.status).toBe(200);
    const favoritesBody = (await favoritesRes.json()) as { items: Array<{ series: { tmdbId: number } }> };
    expect(favoritesBody.items).toEqual([
      expect.objectContaining({ series: expect.objectContaining({ tmdbId: 1396 }) }),
    ]);

    const listsRes = await app.request(`/api/users/${username}/series/lists`, undefined, env);
    expect(listsRes.status).toBe(200);
    const listsBody = (await listsRes.json()) as { lists: Array<{ id: string; name: string }> };
    expect(listsBody.lists).toEqual([expect.objectContaining({ id: listId, name: "Maratonadas" })]);

    const listDetailRes = await app.request(`/api/users/${username}/series/lists/${listId}`, undefined, env);
    expect(listDetailRes.status).toBe(200);
  });

  it("lista as marcações, favoritos e listas públicas de filmes do usuário", async () => {
    const { cookie, username } = await createAuthenticatedUser(app, env);

    const tmdbMovieDetail = (id: number, title: string) => ({
      id,
      title,
      poster_path: `/poster-${id}.jpg`,
      release_date: "2010-07-15",
      overview: `Resumo do filme ${id}`,
      genres: [{ id: 28, name: "Action" }],
      runtime: 148,
      vote_average: 8.4,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse(tmdbMovieDetail(27205, "Inception"))),
    );
    await app.request(
      "/api/movies/27205/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "watched" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse(tmdbMovieDetail(27205, "Inception"))),
    );
    await app.request(
      "/api/movies/27205/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const createListRes = await app.request(
      "/api/movies-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Vistos em 2026" }),
      },
      env,
    );
    const { id: listId } = (await createListRes.json()) as { id: string };

    const entriesRes = await app.request(`/api/users/${username}/movies/entries`, undefined, env);
    expect(entriesRes.status).toBe(200);
    const entriesBody = (await entriesRes.json()) as { items: Array<{ movie: { tmdbId: number } }> };
    expect(entriesBody.items).toEqual([
      expect.objectContaining({ movie: expect.objectContaining({ tmdbId: 27205 }) }),
    ]);

    const favoritesRes = await app.request(`/api/users/${username}/movies/favorites`, undefined, env);
    expect(favoritesRes.status).toBe(200);
    const favoritesBody = (await favoritesRes.json()) as { items: Array<{ movie: { tmdbId: number } }> };
    expect(favoritesBody.items).toEqual([
      expect.objectContaining({ movie: expect.objectContaining({ tmdbId: 27205 }) }),
    ]);

    const listsRes = await app.request(`/api/users/${username}/movies/lists`, undefined, env);
    expect(listsRes.status).toBe(200);
    const listsBody = (await listsRes.json()) as { lists: Array<{ id: string; name: string }> };
    expect(listsBody.lists).toEqual([expect.objectContaining({ id: listId, name: "Vistos em 2026" })]);

    const listDetailRes = await app.request(`/api/users/${username}/movies/lists/${listId}`, undefined, env);
    expect(listDetailRes.status).toBe(200);
  });

  it("lista as marcações, favoritos e listas públicas de livros do usuário", async () => {
    const { cookie, username } = await createAuthenticatedUser(app, env);

    const googleBooksVolume = (id: string, title: string) => ({
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
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse(googleBooksVolume("book-901", "Duna"))),
    );
    await app.request(
      "/api/books/book-901/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "read" }),
      },
      env,
    );
    vi.unstubAllGlobals();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse(googleBooksVolume("book-901", "Duna"))),
    );
    await app.request(
      "/api/books/book-901/entry",
      {
        method: "PUT",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: true }),
      },
      env,
    );
    vi.unstubAllGlobals();

    const createListRes = await app.request(
      "/api/books-lists",
      {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lidos em 2026" }),
      },
      env,
    );
    const { id: listId } = (await createListRes.json()) as { id: string };

    const entriesRes = await app.request(`/api/users/${username}/books/entries`, undefined, env);
    expect(entriesRes.status).toBe(200);
    const entriesBody = (await entriesRes.json()) as { items: Array<{ book: { googleBooksId: string } }> };
    expect(entriesBody.items).toEqual([
      expect.objectContaining({ book: expect.objectContaining({ googleBooksId: "book-901" }) }),
    ]);

    const favoritesRes = await app.request(`/api/users/${username}/books/favorites`, undefined, env);
    expect(favoritesRes.status).toBe(200);
    const favoritesBody = (await favoritesRes.json()) as { items: Array<{ book: { googleBooksId: string } }> };
    expect(favoritesBody.items).toEqual([
      expect.objectContaining({ book: expect.objectContaining({ googleBooksId: "book-901" }) }),
    ]);

    const listsRes = await app.request(`/api/users/${username}/books/lists`, undefined, env);
    expect(listsRes.status).toBe(200);
    const listsBody = (await listsRes.json()) as { lists: Array<{ id: string; name: string }> };
    expect(listsBody.lists).toEqual([expect.objectContaining({ id: listId, name: "Lidos em 2026" })]);

    const listDetailRes = await app.request(`/api/users/${username}/books/lists/${listId}`, undefined, env);
    expect(listDetailRes.status).toBe(200);
  });
});

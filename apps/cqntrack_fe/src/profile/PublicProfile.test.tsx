import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { PublicProfile } from "./PublicProfile";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

const PROFILE = {
  username: "gamer_1",
  displayUsername: "Gamer_1",
  memberSince: "2026-01-01T00:00:00.000Z",
  image: null,
};

const GAME = {
  igdbId: 1942,
  name: "The Witcher 3: Wild Hunt",
  coverUrl: null,
  firstReleaseDate: "2015-05-19",
  platforms: [],
  genres: [],
  rating: null,
};

const SERIES = {
  tmdbId: 1396,
  name: "Breaking Bad",
  posterUrl: null,
  firstAirDate: "2008-01-20",
  genres: [],
  numberOfSeasons: null,
  numberOfEpisodes: null,
  seasons: null,
  rating: null,
};

const MOVIE = {
  tmdbId: 27205,
  name: "Inception",
  posterUrl: null,
  releaseDate: "2010-07-15",
  genres: [],
  runtime: null,
  rating: null,
};

const BOOK = {
  googleBooksId: "PCq3AAAAQBAJ",
  title: "Dom Casmurro",
  authors: [],
  coverUrl: null,
  publishedDate: "1899",
  categories: [],
  pageCount: null,
  rating: null,
};

const EMPTY_ITEMS = { items: [] };
const EMPTY_ENTRIES = { items: [], page: 1, pageSize: 24, total: 0 };

function renderProfile(username = "gamer_1") {
  render(
    <MemoryRouter initialEntries={[`/@${username}`]}>
      <Routes>
        <Route path="/:handle" element={<PublicProfile />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicProfile", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra header e as 6 seções de favoritos/recentes, sem exigir sessão", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/users/gamer_1") return Promise.resolve(PROFILE);

      if (path === "/api/users/gamer_1/movies/favorites") {
        return Promise.resolve({
          items: [
            {
              id: "1",
              status: "watched",
              rating: null,
              watchedAt: "2026-01-01T00:00:00.000Z",
              favoritedAt: "2026-01-02T00:00:00.000Z",
              review: null,
              updatedAt: "2026-01-02T00:00:00.000Z",
              movie: MOVIE,
            },
          ],
        });
      }
      if (path === "/api/users/gamer_1/series/favorites") {
        return Promise.resolve({
          items: [
            {
              id: "1",
              rating: null,
              watchedEpisodeCount: 10,
              favoritedAt: "2026-01-03T00:00:00.000Z",
              review: null,
              updatedAt: "2026-01-03T00:00:00.000Z",
              series: SERIES,
            },
          ],
        });
      }
      if (path === "/api/users/gamer_1/books/favorites") return Promise.resolve(EMPTY_ITEMS);
      if (path === "/api/users/gamer_1/games/favorites") return Promise.resolve(EMPTY_ITEMS);

      if (path.startsWith("/api/users/gamer_1/movies/entries")) {
        return Promise.resolve({
          items: [
            {
              id: "1",
              status: "watched",
              rating: null,
              watchedAt: "2026-01-01T00:00:00.000Z",
              favoritedAt: null,
              review: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
              movie: MOVIE,
            },
          ],
          page: 1,
          pageSize: 12,
          total: 1,
        });
      }
      if (path.startsWith("/api/users/gamer_1/series/recently-watched")) {
        return Promise.resolve({
          items: [{ series: SERIES, lastWatchedAt: "2026-01-02T00:00:00.000Z" }],
        });
      }
      if (path.startsWith("/api/users/gamer_1/books/entries")) {
        return Promise.resolve({
          items: [
            {
              id: "1",
              status: "read",
              rating: null,
              favoritedAt: null,
              review: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
              book: BOOK,
            },
          ],
          page: 1,
          pageSize: 12,
          total: 1,
        });
      }
      if (path.startsWith("/api/users/gamer_1/games/entries")) {
        return Promise.resolve({
          items: [
            {
              id: "1",
              status: "completed",
              rating: null,
              favoritedAt: null,
              platforms: null,
              review: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
              game: GAME,
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
        });
      }

      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderProfile();

    expect(await screen.findByRole("heading", { name: "Gamer_1" })).toBeInTheDocument();
    expect(screen.getByText("@gamer_1")).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: "Filmes e séries favoritos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Assistido recentemente" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jogado recentemente" })).toBeInTheDocument();
    expect(screen.getAllByText("Inception")).not.toHaveLength(0);
    expect(screen.getAllByText("Breaking Bad")).not.toHaveLength(0);
    expect(screen.getByText("Dom Casmurro")).toBeInTheDocument();
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();

    // Sem stats/listas/marcações completas — perfil enxuto (redesign).
    expect(screen.queryByRole("heading", { name: "Listas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Marcações" })).not.toBeInTheDocument();
  });

  it("não mostra uma seção quando ela está vazia", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/users/gamer_1") return Promise.resolve(PROFILE);
      if (path === "/api/users/gamer_1/movies/favorites") return Promise.resolve(EMPTY_ITEMS);
      if (path === "/api/users/gamer_1/series/favorites") return Promise.resolve(EMPTY_ITEMS);
      if (path === "/api/users/gamer_1/books/favorites") return Promise.resolve(EMPTY_ITEMS);
      if (path === "/api/users/gamer_1/games/favorites") return Promise.resolve(EMPTY_ITEMS);
      if (path.startsWith("/api/users/gamer_1/movies/entries")) return Promise.resolve(EMPTY_ENTRIES);
      if (path.startsWith("/api/users/gamer_1/series/recently-watched")) {
        return Promise.resolve({ items: [] });
      }
      if (path.startsWith("/api/users/gamer_1/books/entries")) return Promise.resolve(EMPTY_ENTRIES);
      if (path.startsWith("/api/users/gamer_1/games/entries")) return Promise.resolve(EMPTY_ENTRIES);
      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderProfile();

    expect(await screen.findByRole("heading", { name: "Gamer_1" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Filmes e séries favoritos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Assistido recentemente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Lido recentemente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Jogado recentemente" })).not.toBeInTheDocument();
  });

  it("mostra 'usuário não encontrado' em 404", async () => {
    getMock.mockRejectedValue(new ApiError(404, "not found"));
    renderProfile("nao-existe");

    expect(await screen.findByText("Usuário não encontrado.")).toBeInTheDocument();
  });

  it("mostra 'usuário não encontrado' quando a URL não tem o @ (handle inválido), sem chamar a API", async () => {
    render(
      <MemoryRouter initialEntries={["/gamer_1"]}>
        <Routes>
          <Route path="/:handle" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Usuário não encontrado.")).toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("mostra erro genérico em outras falhas", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderProfile();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar o perfil");
  });
});

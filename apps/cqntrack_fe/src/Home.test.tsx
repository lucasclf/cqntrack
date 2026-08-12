import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("./lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const EMPTY_FAVORITES = { items: [] };

describe("Home", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra o título, as grades de favoritos (jogos, séries, filmes e livros) e a atividade recente do usuário", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/activity") return Promise.resolve({ items: [], nextCursor: null });
      if (path === "/api/games/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/series/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/movies/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/books/favorites") return Promise.resolve(EMPTY_FAVORITES);
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "cqntrack" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jogos favoritos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Séries favoritas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Filmes favoritos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Livros favoritos" })).toBeInTheDocument();
    expect(await screen.findByText(/Nenhuma atividade ainda/)).toBeInTheDocument();
    expect(await screen.findAllByText(/Nenhum.*favoritad[oa] ainda\.|Nenhuma.*favoritada ainda\./)).toHaveLength(4);
    expect(getMock).toHaveBeenCalledWith("/api/activity");
    expect(getMock).toHaveBeenCalledWith("/api/games/favorites");
    expect(getMock).toHaveBeenCalledWith("/api/series/favorites");
    expect(getMock).toHaveBeenCalledWith("/api/movies/favorites");
    expect(getMock).toHaveBeenCalledWith("/api/books/favorites");
  });

  it("mostra os jogos já favoritados", async () => {
    const GAME = {
      igdbId: 1942,
      name: "The Witcher 3: Wild Hunt",
      coverUrl: null,
      firstReleaseDate: "2015-05-19",
      platforms: [],
      genres: [],
      rating: null,
    };
    getMock.mockImplementation((path: string) => {
      if (path === "/api/activity") return Promise.resolve({ items: [], nextCursor: null });
      if (path === "/api/series/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/movies/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/books/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/games/favorites") {
        return Promise.resolve({
          items: [
            {
              id: "1",
              status: null,
              rating: null,
              favoritedAt: "2026-01-01T00:00:00.000Z",
              platforms: null,
              review: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
              game: GAME,
            },
          ],
        });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(await screen.findByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();
  });

  it("mostra as séries já favoritadas", async () => {
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
    getMock.mockImplementation((path: string) => {
      if (path === "/api/activity") return Promise.resolve({ items: [], nextCursor: null });
      if (path === "/api/games/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/movies/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/books/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/series/favorites") {
        return Promise.resolve({
          items: [
            {
              id: "1",
              rating: null,
              watchedEpisodeCount: 0,
              favoritedAt: "2026-01-01T00:00:00.000Z",
              review: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
              series: SERIES,
            },
          ],
        });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Breaking Bad")).toBeInTheDocument();
  });

  it("mostra os filmes já favoritados", async () => {
    const MOVIE = {
      tmdbId: 27205,
      name: "Inception",
      posterUrl: null,
      releaseDate: "2010-07-15",
      genres: [],
      runtime: null,
      rating: null,
    };
    getMock.mockImplementation((path: string) => {
      if (path === "/api/activity") return Promise.resolve({ items: [], nextCursor: null });
      if (path === "/api/games/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/series/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/books/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/movies/favorites") {
        return Promise.resolve({
          items: [
            {
              id: "1",
              status: null,
              rating: null,
              watchedAt: null,
              favoritedAt: "2026-01-01T00:00:00.000Z",
              review: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
              movie: MOVIE,
            },
          ],
        });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Inception")).toBeInTheDocument();
  });

  it("mostra os livros já favoritados", async () => {
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
    getMock.mockImplementation((path: string) => {
      if (path === "/api/activity") return Promise.resolve({ items: [], nextCursor: null });
      if (path === "/api/games/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/series/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/movies/favorites") return Promise.resolve(EMPTY_FAVORITES);
      if (path === "/api/books/favorites") {
        return Promise.resolve({
          items: [
            {
              id: "1",
              status: null,
              rating: null,
              favoritedAt: "2026-01-01T00:00:00.000Z",
              review: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
              book: BOOK,
            },
          ],
        });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Dom Casmurro")).toBeInTheDocument();
  });
});

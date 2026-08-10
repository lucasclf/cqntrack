import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("./lib/games-client", () => ({
  gamesClient: { get: getMock },
}));

const GAME = {
  igdbId: 1942,
  name: "The Witcher 3: Wild Hunt",
  coverUrl: null,
  firstReleaseDate: "2015-05-19",
  platforms: [],
  genres: [],
  rating: null,
};

const EMPTY_SLOTS = {
  slots: [
    { slot: 1, entry: null },
    { slot: 2, entry: null },
    { slot: 3, entry: null },
    { slot: 4, entry: null },
  ],
};

describe("Home", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra o título, os slots de favoritos e a atividade recente do usuário", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/activity") return Promise.resolve({ items: [], nextCursor: null });
      if (path === "/api/games/favorites") return Promise.resolve(EMPTY_SLOTS);
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "cqntrack" })).toBeInTheDocument();
    expect(await screen.findByText(/Nenhuma atividade ainda/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Adicionar favorito 1" })).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/activity");
    expect(getMock).toHaveBeenCalledWith("/api/games/favorites");
  });

  it("mostra os jogos já favoritados nos respectivos slots", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/activity") return Promise.resolve({ items: [], nextCursor: null });
      if (path === "/api/games/favorites") {
        return Promise.resolve({
          slots: [
            {
              slot: 1,
              entry: {
                id: "1",
                status: null,
                rating: null,
                favoriteSlot: 1,
                platforms: null,
                review: null,
                updatedAt: "2026-01-01T00:00:00.000Z",
                game: GAME,
              },
            },
            { slot: 2, entry: null },
            { slot: 3, entry: null },
            { slot: 4, entry: null },
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
    expect(screen.getByRole("button", { name: "Trocar favorito 1" })).toBeInTheDocument();
  });
});

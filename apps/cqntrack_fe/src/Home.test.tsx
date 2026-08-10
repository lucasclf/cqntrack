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

describe("Home", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra o título e a atividade recente do usuário", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/activity") return Promise.resolve({ items: [], nextCursor: null });
      if (path.startsWith("/api/games/entries")) {
        return Promise.resolve({ items: [], page: 1, pageSize: 4, total: 0 });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "cqntrack" })).toBeInTheDocument();
    expect(await screen.findByText(/Nenhuma atividade ainda/)).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/activity");
  });

  it("mostra a seção de favoritos quando o usuário tem jogos favoritados", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/activity") return Promise.resolve({ items: [], nextCursor: null });
      if (path.startsWith("/api/games/entries")) {
        return Promise.resolve({
          items: [
            {
              id: "1",
              status: null,
              rating: null,
              favorite: true,
              platforms: null,
              review: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
              game: GAME,
            },
          ],
          page: 1,
          pageSize: 4,
          total: 1,
        });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Favoritos" })).toBeInTheDocument();
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/games/entries?favorite=true&pageSize=4");
  });
});

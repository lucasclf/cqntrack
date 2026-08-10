import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesSection } from "./FavoritesSection";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/games-client", () => ({
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

function renderSection(entriesEndpoint = "/api/games/entries") {
  render(
    <MemoryRouter>
      <FavoritesSection entriesEndpoint={entriesEndpoint} />
    </MemoryRouter>,
  );
}

describe("FavoritesSection", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("busca com favorite=true&pageSize=4 e mostra os jogos favoritados", async () => {
    getMock.mockResolvedValue({
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
    renderSection();

    expect(await screen.findByRole("heading", { name: "Favoritos" })).toBeInTheDocument();
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/games/entries?favorite=true&pageSize=4");
  });

  it("usa o endpoint público quando informado", async () => {
    getMock.mockResolvedValue({ items: [], page: 1, pageSize: 4, total: 0 });
    renderSection("/api/users/gamer_1/entries");

    expect(getMock).toHaveBeenCalledWith("/api/users/gamer_1/entries?favorite=true&pageSize=4");
  });

  it("não renderiza nada quando não há favoritos", () => {
    getMock.mockResolvedValue({ items: [], page: 1, pageSize: 4, total: 0 });
    const { container } = render(
      <MemoryRouter>
        <FavoritesSection entriesEndpoint="/api/games/entries" />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    const { container } = render(
      <MemoryRouter>
        <FavoritesSection entriesEndpoint="/api/games/entries" />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

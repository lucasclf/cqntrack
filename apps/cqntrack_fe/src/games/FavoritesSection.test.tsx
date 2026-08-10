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

const ENTRY = {
  id: "1",
  status: null,
  rating: null,
  favoriteSlot: 1,
  platforms: null,
  review: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  game: GAME,
};

function renderSection(favoritesEndpoint = "/api/users/gamer_1/favorites") {
  return render(
    <MemoryRouter>
      <FavoritesSection favoritesEndpoint={favoritesEndpoint} />
    </MemoryRouter>,
  );
}

describe("FavoritesSection", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("busca no endpoint informado e mostra só os slots preenchidos", async () => {
    getMock.mockResolvedValue({
      slots: [
        { slot: 1, entry: ENTRY },
        { slot: 2, entry: null },
        { slot: 3, entry: null },
        { slot: 4, entry: null },
      ],
    });
    renderSection();

    expect(await screen.findByRole("heading", { name: "Favoritos" })).toBeInTheDocument();
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/users/gamer_1/favorites");
  });

  it("não renderiza nada quando todos os slots estão vazios", async () => {
    getMock.mockResolvedValue({
      slots: [
        { slot: 1, entry: null },
        { slot: 2, entry: null },
        { slot: 3, entry: null },
        { slot: 4, entry: null },
      ],
    });
    const { container } = renderSection();

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    const { container } = renderSection();

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

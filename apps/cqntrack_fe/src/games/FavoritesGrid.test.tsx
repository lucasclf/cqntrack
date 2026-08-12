import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { FavoritesGrid } from "./FavoritesGrid";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const GAME_ENTRY = {
  id: "1",
  status: "playing",
  rating: 4.5,
  favoritedAt: "2026-01-02T00:00:00.000Z",
  platforms: null,
  review: null,
  updatedAt: "2026-01-02T00:00:00.000Z",
  game: {
    igdbId: 1942,
    name: "Hollow Knight",
    coverUrl: null,
    firstReleaseDate: "2017-02-24",
    platforms: [],
    genres: [],
    rating: null,
  },
};

function renderGrid() {
  return render(
    <MemoryRouter>
      <FavoritesGrid />
    </MemoryRouter>,
  );
}

describe("FavoritesGrid", () => {
  it("mostra os jogos favoritados", async () => {
    getMock.mockResolvedValue({ items: [GAME_ENTRY] });
    renderGrid();

    expect(await screen.findByText("Hollow Knight")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/games/favorites");
  });

  it("mostra um aviso quando não há favoritos", async () => {
    getMock.mockResolvedValue({ items: [] });
    renderGrid();

    expect(await screen.findByText("Nenhum jogo favoritado ainda.")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderGrid();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar seus favoritos");
  });
});

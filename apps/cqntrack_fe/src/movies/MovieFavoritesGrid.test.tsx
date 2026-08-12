import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { MovieFavoritesGrid } from "./MovieFavoritesGrid";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const MOVIE_ENTRY = {
  id: "1",
  status: "watched",
  rating: 4.5,
  watchedAt: "2026-01-01T00:00:00.000Z",
  favoritedAt: "2026-01-02T00:00:00.000Z",
  review: null,
  updatedAt: "2026-01-02T00:00:00.000Z",
  movie: {
    tmdbId: 27205,
    name: "Inception",
    posterUrl: null,
    releaseDate: "2010-07-15",
    genres: [],
    runtime: 148,
    rating: null,
  },
};

function renderGrid() {
  return render(
    <MemoryRouter>
      <MovieFavoritesGrid />
    </MemoryRouter>,
  );
}

describe("MovieFavoritesGrid", () => {
  it("mostra os filmes favoritados", async () => {
    getMock.mockResolvedValue({ items: [MOVIE_ENTRY] });
    renderGrid();

    expect(await screen.findByText("Inception")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/movies/favorites");
  });

  it("mostra um aviso quando não há favoritos", async () => {
    getMock.mockResolvedValue({ items: [] });
    renderGrid();

    expect(await screen.findByText("Nenhum filme favoritado ainda.")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderGrid();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar seus favoritos");
  });
});

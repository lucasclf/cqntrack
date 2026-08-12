import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { SeriesFavoritesGrid } from "./SeriesFavoritesGrid";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const SERIES_ENTRY = {
  id: "1",
  rating: 4.5,
  watchedEpisodeCount: 12,
  favoritedAt: "2026-01-02T00:00:00.000Z",
  review: null,
  updatedAt: "2026-01-02T00:00:00.000Z",
  series: {
    tmdbId: 1396,
    name: "Breaking Bad",
    posterUrl: null,
    firstAirDate: "2008-01-20",
    genres: [],
    numberOfSeasons: 5,
    numberOfEpisodes: 62,
    seasons: null,
    rating: null,
  },
};

function renderGrid() {
  return render(
    <MemoryRouter>
      <SeriesFavoritesGrid />
    </MemoryRouter>,
  );
}

describe("SeriesFavoritesGrid", () => {
  it("mostra as séries favoritadas", async () => {
    getMock.mockResolvedValue({ items: [SERIES_ENTRY] });
    renderGrid();

    expect(await screen.findByText("Breaking Bad")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/series/favorites");
  });

  it("mostra um aviso quando não há favoritos", async () => {
    getMock.mockResolvedValue({ items: [] });
    renderGrid();

    expect(await screen.findByText("Nenhuma série favoritada ainda.")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderGrid();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar seus favoritos");
  });
});

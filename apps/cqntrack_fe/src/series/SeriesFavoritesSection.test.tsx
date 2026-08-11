import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeriesFavoritesSection } from "./SeriesFavoritesSection";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

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

const ENTRY = {
  id: "1",
  rating: null,
  watchedEpisodeCount: 0,
  favoriteSlot: 1,
  review: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  series: SERIES,
};

function renderSection(favoritesEndpoint = "/api/users/gamer_1/series/favorites") {
  return render(
    <MemoryRouter>
      <SeriesFavoritesSection favoritesEndpoint={favoritesEndpoint} />
    </MemoryRouter>,
  );
}

describe("SeriesFavoritesSection", () => {
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

    expect(await screen.findByRole("heading", { name: "Séries favoritas" })).toBeInTheDocument();
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/users/gamer_1/series/favorites");
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

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MovieFavoritesSection } from "./MovieFavoritesSection";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const MOVIE = {
  tmdbId: 27205,
  name: "Inception",
  posterUrl: null,
  releaseDate: "2010-07-15",
  genres: [],
  runtime: null,
  rating: null,
};

const ENTRY = {
  id: "1",
  rating: null,
  watchedAt: null,
  favoriteSlot: 1,
  review: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  movie: MOVIE,
};

function renderSection(favoritesEndpoint = "/api/users/gamer_1/movies/favorites") {
  return render(
    <MemoryRouter>
      <MovieFavoritesSection favoritesEndpoint={favoritesEndpoint} />
    </MemoryRouter>,
  );
}

describe("MovieFavoritesSection", () => {
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

    expect(await screen.findByRole("heading", { name: "Filmes favoritos" })).toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/users/gamer_1/movies/favorites");
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

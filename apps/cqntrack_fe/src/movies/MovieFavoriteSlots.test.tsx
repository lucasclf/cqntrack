import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MovieFavoriteSlots } from "./MovieFavoriteSlots";

const { getMock, putMock } = vi.hoisted(() => ({ getMock: vi.fn(), putMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock, put: putMock },
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

const EMPTY_SLOTS = {
  slots: [
    { slot: 1, entry: null },
    { slot: 2, entry: null },
    { slot: 3, entry: null },
    { slot: 4, entry: null },
  ],
};

function renderSlots() {
  render(
    <MemoryRouter>
      <MovieFavoriteSlots />
    </MemoryRouter>,
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("MovieFavoriteSlots", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra os 4 slots vazios quando não há favoritos", async () => {
    getMock.mockResolvedValue(EMPTY_SLOTS);
    renderSlots();

    expect(await screen.findByRole("button", { name: "Adicionar favorito 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar favorito 4" })).toBeInTheDocument();
  });

  it("clicar num slot vazio abre o popup, e escolher um filme preenche o slot", async () => {
    vi.useFakeTimers();
    getMock.mockImplementation((path: string) => {
      if (path === "/api/movies/favorites") return Promise.resolve(EMPTY_SLOTS);
      if (path.startsWith("/api/movies/search")) return Promise.resolve({ results: [MOVIE] });
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    putMock.mockResolvedValue({
      id: "1",
      rating: null,
      watchedAt: null,
      favoriteSlot: 1,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderSlots();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar favorito 1" }));

    fireEvent.change(screen.getByLabelText("Buscar filme"), { target: { value: "inception" } });
    await advance(300);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Inception" }));
    });

    expect(putMock).toHaveBeenCalledWith("/api/movies/favorites/1", { tmdbId: 27205 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByText("Inception").length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it("mostra o botão de editar num slot já preenchido", async () => {
    getMock.mockResolvedValue({
      slots: [
        {
          slot: 1,
          entry: {
            id: "1",
            rating: null,
            watchedAt: null,
            favoriteSlot: 1,
            review: null,
            updatedAt: "2026-01-01T00:00:00.000Z",
            movie: MOVIE,
          },
        },
        { slot: 2, entry: null },
        { slot: 3, entry: null },
        { slot: 4, entry: null },
      ],
    });
    renderSlots();

    expect(await screen.findByRole("button", { name: "Trocar favorito 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar favorito 1" })).not.toBeInTheDocument();
  });

  it("mostra erro quando a busca inicial falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderSlots();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar seus favoritos");
  });
});

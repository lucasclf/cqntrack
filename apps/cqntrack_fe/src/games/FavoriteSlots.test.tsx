import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavoriteSlots } from "./FavoriteSlots";

const { getMock, putMock } = vi.hoisted(() => ({ getMock: vi.fn(), putMock: vi.fn() }));

vi.mock("../lib/games-client", () => ({
  gamesClient: { get: getMock, put: putMock },
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

function renderSlots() {
  render(
    <MemoryRouter>
      <FavoriteSlots />
    </MemoryRouter>,
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("FavoriteSlots", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
  });

  it("mostra os 4 slots vazios quando não há favoritos", async () => {
    getMock.mockResolvedValue(EMPTY_SLOTS);
    renderSlots();

    expect(await screen.findByRole("button", { name: "Adicionar favorito 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar favorito 4" })).toBeInTheDocument();
  });

  it("clicar num slot vazio abre o popup, e escolher um jogo preenche o slot", async () => {
    vi.useFakeTimers();
    getMock.mockImplementation((path: string) => {
      if (path === "/api/games/favorites") return Promise.resolve(EMPTY_SLOTS);
      if (path.startsWith("/api/games/search")) return Promise.resolve({ results: [GAME] });
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    putMock.mockResolvedValue({
      id: "1",
      status: null,
      rating: null,
      favoriteSlot: 1,
      platforms: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderSlots();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar favorito 1" }));

    fireEvent.change(screen.getByLabelText("Buscar jogo"), { target: { value: "witcher" } });
    await advance(300);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "The Witcher 3: Wild Hunt" }));
    });

    expect(putMock).toHaveBeenCalledWith("/api/games/favorites/1", { igdbId: 1942 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByText("The Witcher 3: Wild Hunt").length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it("mostra o botão de editar num slot já preenchido", async () => {
    getMock.mockResolvedValue({
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
    renderSlots();

    expect(await screen.findByRole("button", { name: "Trocar favorito 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar favorito 1" })).not.toBeInTheDocument();
  });

  it("mostra erro quando a busca inicial falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderSlots();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar seus favoritos");
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

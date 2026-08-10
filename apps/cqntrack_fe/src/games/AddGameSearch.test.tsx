import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddGameSearch } from "./AddGameSearch";

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

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("AddGameSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca com debounce e mostra o botão adicionar", async () => {
    getMock.mockResolvedValue({ results: [GAME] });
    const onAdd = vi.fn();
    render(<AddGameSearch onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText("Buscar jogo pra adicionar à lista"), {
      target: { value: "witcher" },
    });
    await advance(300);

    expect(getMock).toHaveBeenCalledWith("/api/games/search?q=witcher");
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(onAdd).toHaveBeenCalledWith(GAME);
  });

  it("zera o input e os resultados assim que adiciona o jogo", async () => {
    getMock.mockResolvedValue({ results: [GAME] });
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddGameSearch onAdd={onAdd} />);

    const input = screen.getByLabelText("Buscar jogo pra adicionar à lista");
    fireEvent.change(input, { target: { value: "witcher" } });
    await advance(300);
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });

    expect(input).toHaveValue("");
    expect(screen.queryByText("The Witcher 3: Wild Hunt")).not.toBeInTheDocument();
  });

  it("mostra 'Já na lista' e desabilita o botão pra jogos em addedIds", async () => {
    getMock.mockResolvedValue({ results: [GAME] });
    render(<AddGameSearch onAdd={vi.fn()} addedIds={new Set([1942])} />);

    fireEvent.change(screen.getByLabelText("Buscar jogo pra adicionar à lista"), {
      target: { value: "witcher" },
    });
    await advance(300);

    expect(screen.getByRole("button", { name: "Já na lista" })).toBeDisabled();
  });
});

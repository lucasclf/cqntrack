import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritePickerModal } from "./FavoritePickerModal";

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

describe("FavoritePickerModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca com debounce e chama onSelect ao clicar num resultado", async () => {
    getMock.mockResolvedValue({ results: [GAME] });
    const onSelect = vi.fn();
    render(<FavoritePickerModal onSelect={onSelect} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Buscar jogo"), { target: { value: "witcher" } });
    await advance(300);

    expect(getMock).toHaveBeenCalledWith("/api/games/search?q=witcher");
    fireEvent.click(screen.getByRole("button", { name: "The Witcher 3: Wild Hunt" }));

    expect(onSelect).toHaveBeenCalledWith(GAME);
  });

  it("fecha ao clicar em cancelar ou no overlay", () => {
    const onClose = vi.fn();
    render(<FavoritePickerModal onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("presentation"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("clicar dentro do modal não fecha o popup", () => {
    const onClose = vi.fn();
    render(<FavoritePickerModal onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MovieFavoritePickerModal } from "./MovieFavoritePickerModal";

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

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("MovieFavoritePickerModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca com debounce e chama onSelect ao clicar num resultado", async () => {
    getMock.mockResolvedValue({ results: [MOVIE] });
    const onSelect = vi.fn();
    render(<MovieFavoritePickerModal onSelect={onSelect} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Buscar filme"), { target: { value: "inception" } });
    await advance(300);

    expect(getMock).toHaveBeenCalledWith("/api/movies/search?q=inception");
    fireEvent.click(screen.getByRole("button", { name: "Inception" }));

    expect(onSelect).toHaveBeenCalledWith(MOVIE);
  });

  it("fecha ao clicar em cancelar ou no overlay", () => {
    const onClose = vi.fn();
    render(<MovieFavoritePickerModal onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("presentation"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("clicar dentro do modal não fecha o popup", () => {
    const onClose = vi.fn();
    render(<MovieFavoritePickerModal onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

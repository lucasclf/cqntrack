import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeriesFavoritePickerModal } from "./SeriesFavoritePickerModal";

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
  rating: null,
};

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("SeriesFavoritePickerModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca com debounce e chama onSelect ao clicar num resultado", async () => {
    getMock.mockResolvedValue({ results: [SERIES] });
    const onSelect = vi.fn();
    render(<SeriesFavoritePickerModal onSelect={onSelect} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Buscar série"), { target: { value: "breaking bad" } });
    await advance(300);

    expect(getMock).toHaveBeenCalledWith("/api/series/search?q=breaking%20bad");
    fireEvent.click(screen.getByRole("button", { name: "Breaking Bad" }));

    expect(onSelect).toHaveBeenCalledWith(SERIES);
  });

  it("fecha ao clicar em cancelar ou no overlay", () => {
    const onClose = vi.fn();
    render(<SeriesFavoritePickerModal onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("presentation"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("clicar dentro do modal não fecha o popup", () => {
    const onClose = vi.fn();
    render(<SeriesFavoritePickerModal onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

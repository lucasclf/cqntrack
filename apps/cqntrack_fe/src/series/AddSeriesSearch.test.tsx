import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddSeriesSearch } from "./AddSeriesSearch";

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

describe("AddSeriesSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca com debounce e mostra o botão adicionar", async () => {
    getMock.mockResolvedValue({ results: [SERIES] });
    const onAdd = vi.fn();
    render(<AddSeriesSearch onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText("Buscar série pra adicionar à lista"), {
      target: { value: "breaking bad" },
    });
    await advance(300);

    expect(getMock).toHaveBeenCalledWith("/api/series/search?q=breaking%20bad");
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(onAdd).toHaveBeenCalledWith(SERIES);
  });

  it("zera o input e os resultados assim que adiciona a série", async () => {
    getMock.mockResolvedValue({ results: [SERIES] });
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddSeriesSearch onAdd={onAdd} />);

    const input = screen.getByLabelText("Buscar série pra adicionar à lista");
    fireEvent.change(input, { target: { value: "breaking bad" } });
    await advance(300);
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });

    expect(input).toHaveValue("");
    expect(screen.queryByText("Breaking Bad")).not.toBeInTheDocument();
  });

  it("mostra 'Já na lista' e desabilita o botão pra séries em addedIds", async () => {
    getMock.mockResolvedValue({ results: [SERIES] });
    render(<AddSeriesSearch onAdd={vi.fn()} addedIds={new Set([1396])} />);

    fireEvent.change(screen.getByLabelText("Buscar série pra adicionar à lista"), {
      target: { value: "breaking bad" },
    });
    await advance(300);

    expect(screen.getByRole("button", { name: "Já na lista" })).toBeDisabled();
  });
});

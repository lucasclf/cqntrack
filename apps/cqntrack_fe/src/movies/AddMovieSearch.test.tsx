import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddMovieSearch } from "./AddMovieSearch";

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

describe("AddMovieSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("busca com debounce e mostra o botão adicionar", async () => {
    getMock.mockResolvedValue({ results: [MOVIE] });
    const onAdd = vi.fn();
    render(<AddMovieSearch onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText("Buscar filme pra adicionar à lista"), {
      target: { value: "inception" },
    });
    await advance(300);

    expect(getMock).toHaveBeenCalledWith("/api/movies/search?q=inception");
    expect(screen.getByText("Inception")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(onAdd).toHaveBeenCalledWith(MOVIE);
  });

  it("zera o input e os resultados assim que adiciona o filme", async () => {
    getMock.mockResolvedValue({ results: [MOVIE] });
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddMovieSearch onAdd={onAdd} />);

    const input = screen.getByLabelText("Buscar filme pra adicionar à lista");
    fireEvent.change(input, { target: { value: "inception" } });
    await advance(300);
    expect(screen.getByText("Inception")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });

    expect(input).toHaveValue("");
    expect(screen.queryByText("Inception")).not.toBeInTheDocument();
  });

  it("mostra 'Já na lista' e desabilita o botão pra filmes em addedIds", async () => {
    getMock.mockResolvedValue({ results: [MOVIE] });
    render(<AddMovieSearch onAdd={vi.fn()} addedIds={new Set([27205])} />);

    fireEvent.change(screen.getByLabelText("Buscar filme pra adicionar à lista"), {
      target: { value: "inception" },
    });
    await advance(300);

    expect(screen.getByRole("button", { name: "Já na lista" })).toBeDisabled();
  });
});

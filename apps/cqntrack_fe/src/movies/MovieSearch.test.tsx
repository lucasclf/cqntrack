import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MovieSearch } from "./MovieSearch";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

function renderSearch() {
  render(
    <MemoryRouter>
      <MovieSearch />
    </MemoryRouter>,
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("MovieSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("só busca 300ms depois de parar de digitar (debounce)", async () => {
    getMock.mockResolvedValue({ results: [] });
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar filmes" }), {
      target: { value: "inception" },
    });

    expect(getMock).not.toHaveBeenCalled();

    await advance(299);
    expect(getMock).not.toHaveBeenCalled();

    await advance(1);
    expect(getMock).toHaveBeenCalledWith("/api/movies/search?q=inception");
  });

  it("mostra os resultados retornados pela busca", async () => {
    getMock.mockResolvedValue({
      results: [
        {
          tmdbId: 27205,
          name: "Inception",
          posterUrl: null,
          releaseDate: "2010-07-15",
          genres: [],
          runtime: null,
          rating: null,
        },
      ],
    });
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar filmes" }), {
      target: { value: "inception" },
    });
    await advance(300);

    expect(screen.getByText("Inception")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar filmes" }), {
      target: { value: "inception" },
    });
    await advance(300);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao buscar filmes");
  });

  it("limpa os resultados quando o campo fica vazio", async () => {
    getMock.mockResolvedValue({
      results: [
        {
          tmdbId: 27205,
          name: "Inception",
          posterUrl: null,
          releaseDate: "2010-07-15",
          genres: [],
          runtime: null,
          rating: null,
        },
      ],
    });
    renderSearch();
    const input = screen.getByRole("searchbox", { name: "Buscar filmes" });

    fireEvent.change(input, { target: { value: "inception" } });
    await advance(300);
    expect(screen.getByText("Inception")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    await advance(300);

    expect(screen.queryByText("Inception")).not.toBeInTheDocument();
  });

  it("mostra o aviso de atribuição da TMDB", () => {
    getMock.mockResolvedValue({ results: [] });
    renderSearch();

    expect(screen.getByText(/uses the TMDB API/)).toBeInTheDocument();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeriesSearch } from "./SeriesSearch";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

function renderSearch() {
  render(
    <MemoryRouter>
      <SeriesSearch />
    </MemoryRouter>,
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("SeriesSearch", () => {
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

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar séries" }), {
      target: { value: "breaking bad" },
    });

    expect(getMock).not.toHaveBeenCalled();

    await advance(299);
    expect(getMock).not.toHaveBeenCalled();

    await advance(1);
    expect(getMock).toHaveBeenCalledWith("/api/series/search?q=breaking%20bad");
  });

  it("mostra os resultados retornados pela busca", async () => {
    getMock.mockResolvedValue({
      results: [
        {
          tmdbId: 1396,
          name: "Breaking Bad",
          posterUrl: null,
          firstAirDate: "2008-01-20",
          genres: [],
          numberOfSeasons: null,
          numberOfEpisodes: null,
          rating: null,
        },
      ],
    });
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar séries" }), {
      target: { value: "breaking bad" },
    });
    await advance(300);

    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar séries" }), {
      target: { value: "breaking bad" },
    });
    await advance(300);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao buscar séries");
  });

  it("limpa os resultados quando o campo fica vazio", async () => {
    getMock.mockResolvedValue({
      results: [
        {
          tmdbId: 1396,
          name: "Breaking Bad",
          posterUrl: null,
          firstAirDate: "2008-01-20",
          genres: [],
          numberOfSeasons: null,
          numberOfEpisodes: null,
          rating: null,
        },
      ],
    });
    renderSearch();
    const input = screen.getByRole("searchbox", { name: "Buscar séries" });

    fireEvent.change(input, { target: { value: "breaking bad" } });
    await advance(300);
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    await advance(300);

    expect(screen.queryByText("Breaking Bad")).not.toBeInTheDocument();
  });

  it("mostra o aviso de atribuição da TMDB", () => {
    getMock.mockResolvedValue({ results: [] });
    renderSearch();

    expect(screen.getByText(/uses the TMDB API/)).toBeInTheDocument();
  });
});

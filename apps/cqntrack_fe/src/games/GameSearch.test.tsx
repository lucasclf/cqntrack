import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameSearch } from "./GameSearch";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

function renderSearch() {
  render(
    <MemoryRouter>
      <GameSearch />
    </MemoryRouter>,
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("GameSearch", () => {
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

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar jogos" }), {
      target: { value: "witcher" },
    });

    expect(getMock).not.toHaveBeenCalled();

    await advance(299);
    expect(getMock).not.toHaveBeenCalled();

    await advance(1);
    expect(getMock).toHaveBeenCalledWith("/api/games/search?q=witcher");
  });

  it("mostra os resultados retornados pela busca", async () => {
    getMock.mockResolvedValue({
      results: [
        {
          igdbId: 1942,
          name: "The Witcher 3: Wild Hunt",
          coverUrl: null,
          firstReleaseDate: "2015-05-19",
          platforms: [],
          genres: [],
          rating: null,
        },
      ],
    });
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar jogos" }), {
      target: { value: "witcher" },
    });
    await advance(300);

    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar jogos" }), {
      target: { value: "witcher" },
    });
    await advance(300);

    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao buscar jogos");
  });

  it("limpa os resultados quando o campo fica vazio", async () => {
    getMock.mockResolvedValue({
      results: [
        {
          igdbId: 1942,
          name: "The Witcher 3: Wild Hunt",
          coverUrl: null,
          firstReleaseDate: "2015-05-19",
          platforms: [],
          genres: [],
          rating: null,
        },
      ],
    });
    renderSearch();
    const input = screen.getByRole("searchbox", { name: "Buscar jogos" });

    fireEvent.change(input, { target: { value: "witcher" } });
    await advance(300);
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    await advance(300);

    expect(screen.queryByText("The Witcher 3: Wild Hunt")).not.toBeInTheDocument();
  });
});

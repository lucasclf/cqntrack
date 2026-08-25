import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeriesDiscover } from "./SeriesDiscover";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

function series(tmdbId: number, name: string) {
  return {
    tmdbId,
    name,
    posterUrl: null,
    firstAirDate: "2008-01-20",
    genres: [],
    numberOfSeasons: null,
    numberOfEpisodes: null,
    seasons: null,
    rating: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SeriesDiscover />
    </MemoryRouter>,
  );
}

describe("SeriesDiscover", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra as populares da primeira página", async () => {
    getMock.mockResolvedValue({ results: [series(1396, "Breaking Bad")], page: 1, hasMore: false });
    renderPage();

    expect(await screen.findByText("Breaking Bad")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/series/discover?page=1");
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("carrega mais e concatena os resultados quando hasMore é true", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/series/discover?page=1") {
        return Promise.resolve({ results: [series(1396, "Breaking Bad")], page: 1, hasMore: true });
      }
      if (path === "/api/series/discover?page=2") {
        return Promise.resolve({ results: [series(1398, "The Wire")], page: 2, hasMore: false });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    renderPage();

    await screen.findByText("Breaking Bad");
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("The Wire")).toBeInTheDocument();
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao carregar séries populares",
    );
  });

  // Bug real reportado: digitar na busca do Descobrir "jogava" pra uma
  // página separada (/series/buscar) em vez de só trocar a lista na mesma
  // tela — ver comentário no topo de SeriesDiscover.tsx.
  describe("busca embutida (substitui a lista sem navegar)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function advance(ms: number) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    }

    it("digitar substitui as populares pelos resultados da busca, sem navegar", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/series/discover?page=1") {
          return Promise.resolve({
            results: [series(1396, "Breaking Bad")],
            page: 1,
            hasMore: false,
          });
        }
        if (path === "/api/series/search?q=wire") {
          return Promise.resolve({ results: [series(1398, "The Wire")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });
      renderPage();
      await advance(0);
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();

      fireEvent.change(screen.getByRole("searchbox", { name: "Buscar séries" }), {
        target: { value: "wire" },
      });
      await advance(300);

      expect(screen.getByText("The Wire")).toBeInTheDocument();
      expect(screen.queryByText("Breaking Bad")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
    });

    it("limpar a busca volta a mostrar as populares", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/series/discover?page=1") {
          return Promise.resolve({
            results: [series(1396, "Breaking Bad")],
            page: 1,
            hasMore: false,
          });
        }
        if (path === "/api/series/search?q=wire") {
          return Promise.resolve({ results: [series(1398, "The Wire")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });
      renderPage();
      await advance(0);
      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();

      const input = screen.getByRole("searchbox", { name: "Buscar séries" });
      fireEvent.change(input, { target: { value: "wire" } });
      await advance(300);
      expect(screen.getByText("The Wire")).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "" } });
      await advance(300);

      expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
      expect(screen.queryByText("The Wire")).not.toBeInTheDocument();
    });

    it("abrindo com ?q= na URL, já entra buscando (restaurado ao voltar de uma série)", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/series/search?q=wire") {
          return Promise.resolve({ results: [series(1398, "The Wire")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });

      render(
        <MemoryRouter initialEntries={["/series?q=wire"]}>
          <SeriesDiscover />
        </MemoryRouter>,
      );
      await advance(0);

      expect(screen.getByText("The Wire")).toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Buscar séries" })).toHaveValue("wire");
    });
  });
});

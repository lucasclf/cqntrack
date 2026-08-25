import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MovieDiscover } from "./MovieDiscover";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

function movie(tmdbId: number, name: string) {
  return {
    tmdbId,
    name,
    posterUrl: null,
    releaseDate: "2010-07-15",
    genres: [],
    runtime: null,
    rating: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MovieDiscover />
    </MemoryRouter>,
  );
}

describe("MovieDiscover", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra os populares da primeira página", async () => {
    getMock.mockResolvedValue({ results: [movie(1, "Inception")], page: 1, hasMore: false });
    renderPage();

    expect(await screen.findByText("Inception")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/movies/discover?page=1");
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("carrega mais e concatena os resultados quando hasMore é true", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/movies/discover?page=1") {
        return Promise.resolve({ results: [movie(1, "Inception")], page: 1, hasMore: true });
      }
      if (path === "/api/movies/discover?page=2") {
        return Promise.resolve({ results: [movie(2, "Tenet")], page: 2, hasMore: false });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    renderPage();

    await screen.findByText("Inception");
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("Tenet")).toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao carregar filmes populares",
    );
  });

  // Bug real reportado: digitar na busca do Descobrir "jogava" pra uma
  // página separada (/filmes/buscar) em vez de só trocar a lista na mesma
  // tela — ver comentário no topo de MovieDiscover.tsx.
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

    it("digitar substitui os populares pelos resultados da busca, sem navegar", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/movies/discover?page=1") {
          return Promise.resolve({ results: [movie(1, "Inception")], page: 1, hasMore: false });
        }
        if (path === "/api/movies/search?q=tenet") {
          return Promise.resolve({ results: [movie(2, "Tenet")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });
      renderPage();
      await advance(0);
      expect(screen.getByText("Inception")).toBeInTheDocument();

      fireEvent.change(screen.getByRole("searchbox", { name: "Buscar filmes" }), {
        target: { value: "tenet" },
      });
      await advance(300);

      expect(screen.getByText("Tenet")).toBeInTheDocument();
      expect(screen.queryByText("Inception")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
    });

    it("limpar a busca volta a mostrar os populares", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/movies/discover?page=1") {
          return Promise.resolve({ results: [movie(1, "Inception")], page: 1, hasMore: false });
        }
        if (path === "/api/movies/search?q=tenet") {
          return Promise.resolve({ results: [movie(2, "Tenet")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });
      renderPage();
      await advance(0);
      expect(screen.getByText("Inception")).toBeInTheDocument();

      const input = screen.getByRole("searchbox", { name: "Buscar filmes" });
      fireEvent.change(input, { target: { value: "tenet" } });
      await advance(300);
      expect(screen.getByText("Tenet")).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "" } });
      await advance(300);

      expect(screen.getByText("Inception")).toBeInTheDocument();
      expect(screen.queryByText("Tenet")).not.toBeInTheDocument();
    });

    it("abrindo com ?q= na URL, já entra buscando (restaurado ao voltar de um filme)", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/movies/search?q=tenet") {
          return Promise.resolve({ results: [movie(2, "Tenet")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });

      render(
        <MemoryRouter initialEntries={["/filmes?q=tenet"]}>
          <MovieDiscover />
        </MemoryRouter>,
      );
      await advance(0);

      expect(screen.getByText("Tenet")).toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Buscar filmes" })).toHaveValue("tenet");
    });
  });
});

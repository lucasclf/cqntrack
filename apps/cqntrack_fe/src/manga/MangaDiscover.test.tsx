import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MangaDiscover } from "./MangaDiscover";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

function manga(mangadexId: string, title: string) {
  return {
    mangadexId,
    title,
    coverUrl: null,
    authors: [],
    tags: [],
    publicationStatus: null,
    year: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MangaDiscover />
    </MemoryRouter>,
  );
}

describe("MangaDiscover", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra os populares da primeira página", async () => {
    getMock.mockResolvedValue({
      results: [manga("m1", "One Piece")],
      page: 1,
      hasMore: false,
    });
    renderPage();

    expect(await screen.findByText("One Piece")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/manga/discover?page=1");
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("carrega mais e concatena os resultados quando hasMore é true", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/manga/discover?page=1") {
        return Promise.resolve({ results: [manga("m1", "One Piece")], page: 1, hasMore: true });
      }
      if (path === "/api/manga/discover?page=2") {
        return Promise.resolve({ results: [manga("m2", "Naruto")], page: 2, hasMore: false });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    renderPage();

    await screen.findByText("One Piece");
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("Naruto")).toBeInTheDocument();
    expect(screen.getByText("One Piece")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao carregar mangás populares",
    );
  });

  // Bug real reportado: digitar na busca do Descobrir "jogava" pra uma
  // página separada (/mangas/buscar) em vez de só trocar a lista na mesma
  // tela — ver comentário no topo de MangaDiscover.tsx.
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
        if (path === "/api/manga/discover?page=1") {
          return Promise.resolve({ results: [manga("m1", "One Piece")], page: 1, hasMore: false });
        }
        if (path === "/api/manga/search?q=naruto") {
          return Promise.resolve({ results: [manga("m2", "Naruto")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });
      renderPage();
      await advance(0);
      expect(screen.getByText("One Piece")).toBeInTheDocument();

      fireEvent.change(screen.getByRole("searchbox", { name: "Buscar mangás" }), {
        target: { value: "naruto" },
      });
      await advance(300);

      expect(screen.getByText("Naruto")).toBeInTheDocument();
      expect(screen.queryByText("One Piece")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
    });

    it("limpar a busca volta a mostrar os populares", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/manga/discover?page=1") {
          return Promise.resolve({ results: [manga("m1", "One Piece")], page: 1, hasMore: false });
        }
        if (path === "/api/manga/search?q=naruto") {
          return Promise.resolve({ results: [manga("m2", "Naruto")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });
      renderPage();
      await advance(0);
      expect(screen.getByText("One Piece")).toBeInTheDocument();

      const input = screen.getByRole("searchbox", { name: "Buscar mangás" });
      fireEvent.change(input, { target: { value: "naruto" } });
      await advance(300);
      expect(screen.getByText("Naruto")).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "" } });
      await advance(300);

      expect(screen.getByText("One Piece")).toBeInTheDocument();
      expect(screen.queryByText("Naruto")).not.toBeInTheDocument();
    });

    it("abrindo com ?q= na URL, já entra buscando (restaurado ao voltar de um mangá)", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/manga/search?q=naruto") {
          return Promise.resolve({ results: [manga("m2", "Naruto")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });

      render(
        <MemoryRouter initialEntries={["/mangas?q=naruto"]}>
          <MangaDiscover />
        </MemoryRouter>,
      );
      await advance(0);

      expect(screen.getByText("Naruto")).toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Buscar mangás" })).toHaveValue("naruto");
    });
  });
});

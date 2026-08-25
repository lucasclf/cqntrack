import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameDiscover } from "./GameDiscover";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

function game(igdbId: number, name: string) {
  return {
    igdbId,
    name,
    coverUrl: null,
    firstReleaseDate: "2015-05-19",
    platforms: [],
    genres: [],
    rating: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <GameDiscover />
    </MemoryRouter>,
  );
}

describe("GameDiscover", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra os aclamados da primeira página", async () => {
    getMock.mockResolvedValue({ results: [game(1942, "The Witcher 3")], page: 1, hasMore: false });
    renderPage();

    expect(await screen.findByText("The Witcher 3")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/games/discover?page=1");
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("carrega mais e concatena os resultados quando hasMore é true", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/games/discover?page=1") {
        return Promise.resolve({ results: [game(1942, "The Witcher 3")], page: 1, hasMore: true });
      }
      if (path === "/api/games/discover?page=2") {
        return Promise.resolve({ results: [game(1020, "Celeste")], page: 2, hasMore: false });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    renderPage();

    await screen.findByText("The Witcher 3");
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("Celeste")).toBeInTheDocument();
    expect(screen.getByText("The Witcher 3")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar jogos aclamados");
  });

  it("filtra por plataforma ao clicar num chip, e reseta ao voltar pra 'Todas'", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/games/discover?page=1") {
        return Promise.resolve({ results: [game(1942, "The Witcher 3")], page: 1, hasMore: false });
      }
      if (path === "/api/games/discover?page=1&platform=ps5") {
        return Promise.resolve({ results: [game(1020, "Celeste")], page: 1, hasMore: false });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    renderPage();
    await screen.findByText("The Witcher 3");

    fireEvent.click(screen.getByRole("button", { name: "PS5" }));
    expect(await screen.findByText("Celeste")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PS5" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    expect(await screen.findByText("The Witcher 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
  });

  // Bug real reportado: digitar na busca do Descobrir "jogava" pra uma
  // página separada (/jogos/buscar) em vez de só trocar a lista na mesma
  // tela — ver comentário no topo de GameDiscover.tsx.
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

    it("digitar substitui os aclamados pelos resultados da busca, sem navegar", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/games/discover?page=1") {
          return Promise.resolve({
            results: [game(1942, "The Witcher 3")],
            page: 1,
            hasMore: false,
          });
        }
        if (path === "/api/games/search?q=celeste") {
          return Promise.resolve({ results: [game(1020, "Celeste")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });
      renderPage();
      await advance(0);
      expect(screen.getByText("The Witcher 3")).toBeInTheDocument();

      fireEvent.change(screen.getByRole("searchbox", { name: "Buscar jogos" }), {
        target: { value: "celeste" },
      });
      await advance(300);

      expect(screen.getByText("Celeste")).toBeInTheDocument();
      expect(screen.queryByText("The Witcher 3")).not.toBeInTheDocument();
      // Sem filtro de plataforma nem "Carregar mais" durante a busca —
      // a rota de busca não suporta nem um nem outro.
      expect(
        screen.queryByRole("group", { name: "Filtrar por plataforma" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
    });

    it("limpar a busca volta a mostrar os aclamados", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/games/discover?page=1") {
          return Promise.resolve({
            results: [game(1942, "The Witcher 3")],
            page: 1,
            hasMore: false,
          });
        }
        if (path === "/api/games/search?q=celeste") {
          return Promise.resolve({ results: [game(1020, "Celeste")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });
      renderPage();
      await advance(0);
      expect(screen.getByText("The Witcher 3")).toBeInTheDocument();

      const input = screen.getByRole("searchbox", { name: "Buscar jogos" });
      fireEvent.change(input, { target: { value: "celeste" } });
      await advance(300);
      expect(screen.getByText("Celeste")).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "" } });
      await advance(300);

      expect(screen.getByText("The Witcher 3")).toBeInTheDocument();
      expect(screen.queryByText("Celeste")).not.toBeInTheDocument();
    });

    it("abrindo com ?q= na URL, já entra buscando (restaurado ao voltar de um jogo)", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/games/search?q=celeste") {
          return Promise.resolve({ results: [game(1020, "Celeste")] });
        }
        return Promise.reject(new Error("rota inesperada: " + path));
      });

      render(
        <MemoryRouter initialEntries={["/jogos?q=celeste"]}>
          <GameDiscover />
        </MemoryRouter>,
      );

      await advance(0);

      expect(screen.getByText("Celeste")).toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Buscar jogos" })).toHaveValue("celeste");
    });
  });
});

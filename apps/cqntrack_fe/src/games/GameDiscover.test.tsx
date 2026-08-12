import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar filmes populares");
  });
});

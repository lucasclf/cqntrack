import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar séries populares");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeriesTabPanel } from "./SeriesTabPanel";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const SERIES = {
  tmdbId: 1396,
  name: "Breaking Bad",
  posterUrl: null,
  firstAirDate: "2008-01-20",
  genres: [],
  numberOfSeasons: 5,
  numberOfEpisodes: 62,
  seasons: null,
  rating: null,
};

function renderPanel(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/:handle/series" element={<SeriesTabPanel />} />
      </Routes>
    </MemoryRouter>,
  );
}

function lastQuery(): URLSearchParams {
  const call = getMock.mock.calls.at(-1) as [string];
  return new URLSearchParams(call[0].split("?")[1]);
}

describe("SeriesTabPanel", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("sem ?view=all, mostra favoritas + assistido recentemente", async () => {
    getMock.mockResolvedValue({
      items: [
        {
          id: "1",
          rating: null,
          watchedEpisodeCount: 3,
          favoritedAt: "2026-01-01T00:00:00.000Z",
          review: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
          series: SERIES,
        },
      ],
      page: 1,
      pageSize: 12,
      total: 1,
    });
    renderPanel("/@lucas/series");

    expect(await screen.findByRole("heading", { name: "Séries favoritas" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Séries acompanhadas" })).not.toBeInTheDocument();
  });

  it("com ?view=all, mostra a listagem completa paginada", async () => {
    getMock.mockResolvedValue({
      items: [{ series: SERIES, lastWatchedAt: "2026-01-02T00:00:00.000Z" }],
      page: 1,
      pageSize: 24,
      total: 50,
    });
    renderPanel("/@lucas/series?view=all");

    expect(await screen.findByRole("heading", { name: "Séries acompanhadas" })).toBeInTheDocument();
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limpar filtro" })).toHaveAttribute(
      "href",
      "/@lucas/series",
    );

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(lastQuery().get("page")).toBe("2");
  });

  it("mostra hint quando não há séries acompanhadas", async () => {
    getMock.mockResolvedValue({ items: [], page: 1, pageSize: 24, total: 0 });
    renderPanel("/@lucas/series?view=all");

    expect(await screen.findByText("Nada por aqui ainda.")).toBeInTheDocument();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySeriesEntries } from "./MySeriesEntries";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const ENTRY = {
  id: "1",
  rating: 4,
  watchedEpisodeCount: 5,
  favoriteSlot: null,
  review: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  series: {
    tmdbId: 1396,
    name: "Breaking Bad",
    posterUrl: null,
    firstAirDate: "2008-01-20",
    genres: [],
    numberOfSeasons: 5,
    numberOfEpisodes: 62,
    seasons: null,
    rating: null,
  },
};

function renderPage() {
  render(
    <MemoryRouter>
      <MySeriesEntries />
    </MemoryRouter>,
  );
}

function lastQuery(): URLSearchParams {
  const call = getMock.mock.calls.at(-1) as [string];
  return new URLSearchParams(call[0].split("?")[1]);
}

describe("MySeriesEntries", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("carrega a primeira página com os filtros padrão", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 1 });
    renderPage();

    expect(await screen.findByText("Breaking Bad")).toBeInTheDocument();
    const query = lastQuery();
    expect(query.get("sortBy")).toBe("updatedAt");
    expect(query.get("order")).toBe("desc");
    expect(query.get("page")).toBe("1");
  });

  it("mostra mensagem quando não há séries com os filtros atuais", async () => {
    getMock.mockResolvedValue({ items: [], page: 1, pageSize: 24, total: 0 });
    renderPage();

    expect(
      await screen.findByText("Nenhuma série encontrada com esses filtros."),
    ).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar suas séries");
  });

  it("refaz a busca com o filtro de favoritos ao marcar a checkbox", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 1 });
    renderPage();
    await screen.findByText("Breaking Bad");

    fireEvent.click(screen.getByLabelText("Somente favoritos"));

    await screen.findByText("Breaking Bad");
    expect(lastQuery().get("favorite")).toBe("true");
  });

  it("navega entre páginas e reseta pra página 1 ao mudar um filtro", async () => {
    getMock.mockResolvedValue({ items: [ENTRY], page: 1, pageSize: 24, total: 50 });
    renderPage();
    await screen.findByText("Breaking Bad");

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await act(async () => {});
    expect(lastQuery().get("page")).toBe("2");

    fireEvent.click(screen.getByLabelText("Somente favoritos"));
    await act(async () => {});
    expect(lastQuery().get("page")).toBe("1");
  });
});

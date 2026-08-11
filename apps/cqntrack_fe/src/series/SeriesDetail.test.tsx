import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { SeriesDetail } from "./SeriesDetail";

const { getMock, putMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, put: putMock, delete: deleteMock, post: vi.fn(), patch: vi.fn() },
  };
});

const SERIES = {
  tmdbId: 1396,
  name: "Breaking Bad",
  posterUrl: null,
  firstAirDate: "2008-01-20",
  genres: ["Drama", "Crime"],
  numberOfSeasons: 5,
  numberOfEpisodes: 62,
  seasons: null,
  rating: 8.9,
  overview: "Um professor de química vira fabricante de metanfetamina.",
};

function renderDetail() {
  render(
    <MemoryRouter initialEntries={["/series/1396"]}>
      <Routes>
        <Route path="/series/:tmdbId" element={<SeriesDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SeriesDetail", () => {
  it("mostra os dados da série e a marcação existente, sem ação de favoritar", async () => {
    getMock.mockResolvedValue({
      series: SERIES,
      entry: {
        id: "1",
        rating: 4.5,
        watchedEpisodeCount: 12,
        favoriteSlot: 1,
        review: "Muito bom",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Breaking Bad" })).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Muito bom")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/series/1396");
    // Favoritar não acontece nesta página (só pelos slots da home).
    expect(screen.queryByRole("button", { name: /favorit/i })).not.toBeInTheDocument();
  });

  it("salva a nota ao clicar numa estrela, criando a marcação quando ainda não existe entry", async () => {
    getMock.mockResolvedValue({ series: SERIES, entry: null });
    putMock.mockResolvedValue({
      id: "2",
      rating: 5,
      watchedEpisodeCount: 0,
      favoriteSlot: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Breaking Bad" });
    fireEvent.click(screen.getByRole("button", { name: "5 estrelas" }));

    expect(putMock).toHaveBeenCalledWith("/api/series/1396/entry", { rating: 5 });
    expect(await screen.findByText("5.0")).toBeInTheDocument();
  });

  it("salva a review ao sair do campo (blur)", async () => {
    getMock.mockResolvedValue({
      series: SERIES,
      entry: {
        id: "1",
        rating: null,
        watchedEpisodeCount: 0,
        favoriteSlot: null,
        review: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    putMock.mockResolvedValue({
      id: "1",
      rating: null,
      watchedEpisodeCount: 0,
      favoriteSlot: null,
      review: "Ótima série",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Breaking Bad" });
    fireEvent.change(screen.getByLabelText("Review"), { target: { value: "Ótima série" } });
    fireEvent.blur(screen.getByLabelText("Review"));

    expect(putMock).toHaveBeenCalledWith("/api/series/1396/entry", { review: "Ótima série" });
  });

  it("remove a marcação existente", async () => {
    getMock.mockResolvedValue({
      series: SERIES,
      entry: {
        id: "1",
        rating: 4,
        watchedEpisodeCount: 3,
        favoriteSlot: null,
        review: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    deleteMock.mockResolvedValue(undefined);
    renderDetail();

    await screen.findByRole("heading", { name: "Breaking Bad" });
    fireEvent.click(screen.getByRole("button", { name: "Remover marcação" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/series/1396/entry");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Remover marcação" })).not.toBeInTheDocument();
    });
  });

  it("mostra 'série não encontrada' quando a API retorna 404", async () => {
    getMock.mockRejectedValue(new ApiError(404, "not found"));
    renderDetail();

    expect(await screen.findByText("Série não encontrada.")).toBeInTheDocument();
  });

  it("mostra mensagem de erro genérica em outras falhas", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar a série");
  });
});

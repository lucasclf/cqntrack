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
  cast: [{ personId: 17419, name: "Bryan Cranston", character: "Walter White", profileUrl: null }],
  creators: [{ personId: 66633, name: "Vince Gilligan", profileUrl: null }],
  directors: [{ personId: 29779, name: "Michelle MacLaren", profileUrl: null, episodeCount: 11 }],
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
  it("mostra os dados da série e a marcação existente, incluindo favorito", async () => {
    getMock.mockResolvedValue({
      series: SERIES,
      entry: {
        id: "1",
        rating: 4.5,
        watchedEpisodeCount: 12,
        favoritedAt: "2026-01-01T00:00:00.000Z",
        review: "Muito bom",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Breaking Bad" })).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Muito bom")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/series/1396");
    expect(screen.getByRole("button", { name: "Desfavoritar" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Criado por, Direção (com contagem de episódios) e Elenco, cada um
    // linkando pra página da pessoa.
    expect(screen.getByRole("heading", { name: "Criado por" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vince Gilligan/ })).toHaveAttribute(
      "href",
      "/pessoas/66633",
    );
    expect(screen.getByRole("heading", { name: "Direção" })).toBeInTheDocument();
    expect(screen.getByText(/Michelle MacLaren/)).toBeInTheDocument();
    expect(screen.getByText("(11 episódios)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Elenco" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bryan Cranston/ })).toHaveAttribute(
      "href",
      "/pessoas/17419",
    );
  });

  it("favorita ao clicar no coração", async () => {
    getMock.mockResolvedValue({ series: SERIES, entry: null });
    putMock.mockResolvedValue({
      id: "2",
      rating: null,
      watchedEpisodeCount: 0,
      favoritedAt: "2026-01-01T00:00:00.000Z",
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Breaking Bad" });
    fireEvent.click(screen.getByRole("button", { name: "Favoritar" }));

    expect(putMock).toHaveBeenCalledWith("/api/series/1396/entry", { favorited: true });
    expect(await screen.findByRole("button", { name: "Desfavoritar" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("abandona ao clicar no botão, e mostra o estado marcado", async () => {
    getMock.mockResolvedValue({ series: SERIES, entry: null });
    putMock.mockResolvedValue({
      id: "2",
      rating: null,
      watchedEpisodeCount: 0,
      favoritedAt: null,
      abandonedAt: "2026-01-01T00:00:00.000Z",
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Breaking Bad" });
    fireEvent.click(screen.getByRole("button", { name: "Abandonar" }));

    expect(putMock).toHaveBeenCalledWith("/api/series/1396/entry", { abandoned: true });
    expect(await screen.findByRole("button", { name: "Abandonada" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("salva a nota ao clicar numa estrela, criando a marcação quando ainda não existe entry", async () => {
    getMock.mockResolvedValue({ series: SERIES, entry: null });
    putMock.mockResolvedValue({
      id: "2",
      rating: 5,
      watchedEpisodeCount: 0,
      favoritedAt: null,
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
        favoritedAt: null,
        review: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    putMock.mockResolvedValue({
      id: "1",
      rating: null,
      watchedEpisodeCount: 0,
      favoritedAt: null,
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
        favoritedAt: null,
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

  it("busca a Temporada 1 em paralelo com o detalhe, sem 'carregando' extra pro episódio", async () => {
    const seriesWithSeasons = {
      ...SERIES,
      seasons: [
        {
          seasonNumber: 1,
          name: "Temporada 1",
          episodeCount: 2,
          airDate: "2008-01-20",
          posterUrl: null,
        },
      ],
    };
    getMock.mockImplementation((path: string) => {
      if (path === "/api/series/1396")
        return Promise.resolve({ series: seriesWithSeasons, entry: null });
      if (path === "/api/series/1396/seasons/1") {
        return Promise.resolve({
          seasonNumber: 1,
          episodes: [
            {
              episodeNumber: 1,
              name: "Pilot",
              airDate: "2008-01-20",
              stillUrl: null,
              watched: false,
            },
          ],
        });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderDetail();

    expect(await screen.findByRole("heading", { name: "Breaking Bad" })).toBeInTheDocument();
    // O episódio já aparece junto com o resto da página, sem "Carregando episódios..." separado.
    expect(screen.getByText("1. Pilot")).toBeInTheDocument();
    expect(screen.queryByText("Carregando episódios...")).not.toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/series/1396/seasons/1");
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

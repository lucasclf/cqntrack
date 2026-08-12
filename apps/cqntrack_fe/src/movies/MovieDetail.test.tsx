import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { MovieDetail } from "./MovieDetail";

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

const MOVIE = {
  tmdbId: 27205,
  name: "Inception",
  posterUrl: null,
  releaseDate: "2010-07-15",
  genres: ["Action", "Science Fiction"],
  runtime: 148,
  rating: 8.4,
  overview: "Um ladrão que rouba segredos corporativos através do uso de tecnologia de sonhos.",
  cast: [
    { personId: 6193, name: "Leonardo DiCaprio", character: "Dom Cobb", profileUrl: null },
  ],
  directors: [{ personId: 525, name: "Christopher Nolan", profileUrl: null }],
};

function renderDetail() {
  render(
    <MemoryRouter initialEntries={["/filmes/27205"]}>
      <Routes>
        <Route path="/filmes/:tmdbId" element={<MovieDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MovieDetail", () => {
  it("mostra os dados do filme e a marcação existente (status, favorito, nota)", async () => {
    getMock.mockResolvedValue({
      movie: MOVIE,
      entry: {
        id: "1",
        status: "watched",
        rating: 4.5,
        watchedAt: "2026-01-01T00:00:00.000Z",
        favoritedAt: "2026-01-01T00:00:00.000Z",
        review: "Muito bom",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Inception" })).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("2h 28min")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Muito bom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Já vi" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Quero ver" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/Assistido em/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desfavoritar" })).toHaveAttribute("aria-pressed", "true");
    expect(getMock).toHaveBeenCalledWith("/api/movies/27205");

    // Direção e elenco, com link pra página da pessoa.
    expect(screen.getByRole("heading", { name: "Direção" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Christopher Nolan/ })).toHaveAttribute(
      "href",
      "/pessoas/525",
    );
    expect(screen.getByRole("heading", { name: "Elenco" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Leonardo DiCaprio/ })).toHaveAttribute(
      "href",
      "/pessoas/6193",
    );
  });

  it("marca status ao clicar num botão, criando a marcação quando ainda não existe entry", async () => {
    getMock.mockResolvedValue({ movie: MOVIE, entry: null });
    putMock.mockResolvedValue({
      id: "2",
      status: "watched",
      rating: null,
      watchedAt: "2026-01-01T00:00:00.000Z",
      favoritedAt: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Inception" });
    fireEvent.click(screen.getByRole("button", { name: "Já vi" }));

    expect(putMock).toHaveBeenCalledWith("/api/movies/27205/entry", { status: "watched" });
    expect(await screen.findByRole("button", { name: "Já vi" })).toHaveAttribute("aria-pressed", "true");
  });

  it("favorita ao clicar no coração", async () => {
    getMock.mockResolvedValue({ movie: MOVIE, entry: null });
    putMock.mockResolvedValue({
      id: "2",
      status: null,
      rating: null,
      watchedAt: null,
      favoritedAt: "2026-01-01T00:00:00.000Z",
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Inception" });
    fireEvent.click(screen.getByRole("button", { name: "Favoritar" }));

    expect(putMock).toHaveBeenCalledWith("/api/movies/27205/entry", { favorited: true });
    expect(await screen.findByRole("button", { name: "Desfavoritar" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("salva a nota ao clicar numa estrela", async () => {
    getMock.mockResolvedValue({ movie: MOVIE, entry: null });
    putMock.mockResolvedValue({
      id: "2",
      status: null,
      rating: 5,
      watchedAt: null,
      favoritedAt: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Inception" });
    fireEvent.click(screen.getByRole("button", { name: "5 estrelas" }));

    expect(putMock).toHaveBeenCalledWith("/api/movies/27205/entry", { rating: 5 });
    expect(await screen.findByText("5.0")).toBeInTheDocument();
  });

  it("salva a review ao sair do campo (blur)", async () => {
    getMock.mockResolvedValue({
      movie: MOVIE,
      entry: {
        id: "1",
        status: null,
        rating: null,
        watchedAt: null,
        favoritedAt: null,
        review: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    putMock.mockResolvedValue({
      id: "1",
      status: null,
      rating: null,
      watchedAt: null,
      favoritedAt: null,
      review: "Ótimo filme",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Inception" });
    fireEvent.change(screen.getByLabelText("Review"), { target: { value: "Ótimo filme" } });
    fireEvent.blur(screen.getByLabelText("Review"));

    expect(putMock).toHaveBeenCalledWith("/api/movies/27205/entry", { review: "Ótimo filme" });
  });

  it("remove a marcação existente", async () => {
    getMock.mockResolvedValue({
      movie: MOVIE,
      entry: {
        id: "1",
        status: null,
        rating: 4,
        watchedAt: null,
        favoritedAt: null,
        review: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    deleteMock.mockResolvedValue(undefined);
    renderDetail();

    await screen.findByRole("heading", { name: "Inception" });
    fireEvent.click(screen.getByRole("button", { name: "Remover marcação" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/movies/27205/entry");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Remover marcação" })).not.toBeInTheDocument();
    });
  });

  it("mostra 'filme não encontrado' quando a API retorna 404", async () => {
    getMock.mockRejectedValue(new ApiError(404, "not found"));
    renderDetail();

    expect(await screen.findByText("Filme não encontrado.")).toBeInTheDocument();
  });

  it("mostra mensagem de erro genérica em outras falhas", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar o filme");
  });
});

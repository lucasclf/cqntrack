import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MovieTabPanel } from "./MovieTabPanel";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const MOVIE = {
  tmdbId: 27205,
  name: "Inception",
  posterUrl: null,
  releaseDate: "2010-07-15",
  genres: [],
  runtime: 148,
  rating: null,
};

function entry(id: string) {
  return {
    id,
    status: "watched",
    rating: null,
    watchedAt: "2026-01-01T00:00:00.000Z",
    favoritedAt: null,
    review: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    movie: MOVIE,
  };
}

function renderPanel(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/:handle/filmes" element={<MovieTabPanel />} />
      </Routes>
    </MemoryRouter>,
  );
}

function lastQuery(): URLSearchParams {
  const call = getMock.mock.calls.at(-1) as [string];
  return new URLSearchParams(call[0].split("?")[1]);
}

describe("MovieTabPanel", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("sem status na URL, mostra favoritos + assistido recentemente (não busca listagem completa)", async () => {
    getMock.mockResolvedValue({ items: [entry("1")], page: 1, pageSize: 12, total: 1 });
    renderPanel("/@lucas/filmes");

    expect(await screen.findByRole("heading", { name: "Filmes favoritos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Assistido recentemente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anterior" })).not.toBeInTheDocument();
  });

  it("com status na URL, usa o rótulo do status como título e filtra a busca", async () => {
    getMock.mockResolvedValue({ items: [entry("1")], page: 1, pageSize: 24, total: 1 });
    renderPanel("/@lucas/filmes?status=want_to_watch");

    expect(await screen.findByRole("heading", { name: "Quero ver" })).toBeInTheDocument();
    expect(lastQuery().get("status")).toBe("want_to_watch");
    expect(screen.getByRole("link", { name: "Limpar filtro" })).toHaveAttribute(
      "href",
      "/@lucas/filmes",
    );
  });

  it("pagina com os botões Anterior/Próxima", async () => {
    getMock.mockResolvedValue({ items: [entry("1")], page: 1, pageSize: 24, total: 50 });
    renderPanel("/@lucas/filmes?status=watched");

    await screen.findByText("Inception");
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(lastQuery().get("page")).toBe("2");
  });

  it("mostra hint quando não há itens com o status filtrado", async () => {
    getMock.mockResolvedValue({ items: [], page: 1, pageSize: 24, total: 0 });
    renderPanel("/@lucas/filmes?status=watched");

    expect(await screen.findByText("Nada por aqui ainda.")).toBeInTheDocument();
  });

  it("status inválido na URL é tratado como ausente", async () => {
    getMock.mockResolvedValue({ items: [entry("1")], page: 1, pageSize: 12, total: 1 });
    renderPanel("/@lucas/filmes?status=nao-existe");

    expect(await screen.findByRole("heading", { name: "Filmes favoritos" })).toBeInTheDocument();
  });
});

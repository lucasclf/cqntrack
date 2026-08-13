import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicMovieEntries } from "./PublicMovieEntries";

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

function renderPage(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/:handle/filmes" element={<PublicMovieEntries />} />
      </Routes>
    </MemoryRouter>,
  );
}

function lastQuery(): URLSearchParams {
  const call = getMock.mock.calls.at(-1) as [string];
  return new URLSearchParams(call[0].split("?")[1]);
}

describe("PublicMovieEntries", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("sem status na URL, mostra título genérico 'Filmes' e busca sem filtro", async () => {
    getMock.mockResolvedValue({ items: [entry("1")], page: 1, pageSize: 24, total: 1 });
    renderPage("/@lucas/filmes");

    expect(await screen.findByRole("heading", { name: "Filmes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar pro perfil/ })).toHaveAttribute("href", "/@lucas");
    expect(lastQuery().get("status")).toBeNull();
  });

  it("com status na URL, usa o rótulo do status como título e filtra a busca", async () => {
    getMock.mockResolvedValue({ items: [entry("1")], page: 1, pageSize: 24, total: 1 });
    renderPage("/@lucas/filmes?status=want_to_watch");

    expect(await screen.findByRole("heading", { name: "Quero ver" })).toBeInTheDocument();
    expect(lastQuery().get("status")).toBe("want_to_watch");
  });

  it("pagina com os botões Anterior/Próxima", async () => {
    getMock.mockResolvedValue({ items: [entry("1")], page: 1, pageSize: 24, total: 50 });
    renderPage("/@lucas/filmes");

    await screen.findByText("Inception");
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(lastQuery().get("page")).toBe("2");
  });

  it("mostra hint quando não há itens", async () => {
    getMock.mockResolvedValue({ items: [], page: 1, pageSize: 24, total: 0 });
    renderPage("/@lucas/filmes");

    expect(await screen.findByText("Nada por aqui ainda.")).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderPage("/@lucas/filmes");

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar");
  });

  it("handle inválido (sem @) mostra 'usuário não encontrado', sem chamar a API", async () => {
    renderPage("/lucas/filmes");

    expect(await screen.findByText("Usuário não encontrado.")).toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });
});

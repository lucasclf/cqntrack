import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { MovieListDetail } from "./MovieListDetail";

const { getMock, patchMock, deleteMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
}));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, patch: patchMock, delete: deleteMock, put: putMock, post: vi.fn() },
  };
});

const DETAIL = {
  id: "1",
  name: "Vistos em 2026",
  description: "Já vi tudo",
  itemCount: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  items: [
    {
      tmdbId: 27205,
      name: "Inception",
      posterUrl: null,
      releaseDate: "2010-07-15",
      genres: [],
      runtime: null,
      rating: null,
    },
  ],
};

function renderPage(initialEntry = "/filmes/listas/1") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/filmes/listas" element={<p>tela de listas</p>} />
        <Route path="/filmes/listas/:listId" element={<MovieListDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MovieListDetail", () => {
  beforeEach(() => {
    getMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    putMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mostra o nome, a descrição e os filmes da lista", async () => {
    getMock.mockResolvedValue(DETAIL);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Vistos em 2026" })).toBeInTheDocument();
    expect(screen.getByText("Já vi tudo")).toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
  });

  it("mostra 'lista não encontrada' em 404", async () => {
    getMock.mockRejectedValue(new ApiError(404, "not found"));
    renderPage();

    expect(await screen.findByText("Lista não encontrada.")).toBeInTheDocument();
  });

  it("remove um filme da lista", async () => {
    getMock.mockResolvedValue(DETAIL);
    deleteMock.mockResolvedValue(undefined);
    renderPage();

    await screen.findByText("Inception");
    fireEvent.click(screen.getByRole("button", { name: "Remover da lista" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/movies-lists/1/items/27205");
    expect(await screen.findByText("Essa lista ainda não tem filmes.")).toBeInTheDocument();
  });

  it("edita nome e descrição pelo modal", async () => {
    getMock.mockResolvedValue(DETAIL);
    patchMock.mockResolvedValue({ ...DETAIL, name: "Nome novo", description: "Nova descrição" });
    renderPage();

    await screen.findByRole("heading", { name: "Vistos em 2026" });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Nome novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("heading", { name: "Nome novo" })).toBeInTheDocument();
    expect(patchMock).toHaveBeenCalledWith("/api/movies-lists/1", {
      name: "Nome novo",
      description: "Já vi tudo",
    });
  });

  it("remove a lista após confirmação e volta pra /listas", async () => {
    getMock.mockResolvedValue(DETAIL);
    deleteMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await screen.findByRole("heading", { name: "Vistos em 2026" });
    fireEvent.click(screen.getByRole("button", { name: "Remover lista" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/movies-lists/1");
    expect(await screen.findByText("tela de listas")).toBeInTheDocument();
  });

  it("adiciona um filme à lista pela busca embutida na própria página", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/movies-lists/1") return Promise.resolve(DETAIL);
      if (path.startsWith("/api/movies/search")) {
        return Promise.resolve({
          results: [
            {
              tmdbId: 155,
              name: "The Dark Knight",
              posterUrl: null,
              releaseDate: null,
              genres: [],
              runtime: null,
              rating: null,
            },
          ],
        });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    putMock.mockResolvedValue(undefined);

    renderPage();
    await screen.findByRole("heading", { name: "Vistos em 2026" });

    // Timers falsos só a partir daqui — o findBy acima usa polling real.
    vi.useFakeTimers();

    fireEvent.change(screen.getByLabelText("Buscar filme pra adicionar à lista"), {
      target: { value: "the dark knight" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });

    expect(putMock).toHaveBeenCalledWith("/api/movies-lists/1/items/155");
    expect(screen.getAllByText("The Dark Knight").length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});

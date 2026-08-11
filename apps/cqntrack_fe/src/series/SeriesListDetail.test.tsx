import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { SeriesListDetail } from "./SeriesListDetail";

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
  name: "Maratonadas",
  description: "Já vi tudo",
  itemCount: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  items: [
    {
      tmdbId: 1396,
      name: "Breaking Bad",
      posterUrl: null,
      firstAirDate: "2008-01-20",
      genres: [],
      numberOfSeasons: null,
      numberOfEpisodes: null,
      rating: null,
    },
  ],
};

function renderPage(initialEntry = "/series/listas/1") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/series/listas" element={<p>tela de listas</p>} />
        <Route path="/series/listas/:listId" element={<SeriesListDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SeriesListDetail", () => {
  beforeEach(() => {
    getMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    putMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mostra o nome, a descrição e as séries da lista", async () => {
    getMock.mockResolvedValue(DETAIL);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Maratonadas" })).toBeInTheDocument();
    expect(screen.getByText("Já vi tudo")).toBeInTheDocument();
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
  });

  it("mostra 'lista não encontrada' em 404", async () => {
    getMock.mockRejectedValue(new ApiError(404, "not found"));
    renderPage();

    expect(await screen.findByText("Lista não encontrada.")).toBeInTheDocument();
  });

  it("remove uma série da lista", async () => {
    getMock.mockResolvedValue(DETAIL);
    deleteMock.mockResolvedValue(undefined);
    renderPage();

    await screen.findByText("Breaking Bad");
    fireEvent.click(screen.getByRole("button", { name: "Remover da lista" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/series-lists/1/items/1396");
    expect(await screen.findByText("Essa lista ainda não tem séries.")).toBeInTheDocument();
  });

  it("edita nome e descrição pelo modal", async () => {
    getMock.mockResolvedValue(DETAIL);
    patchMock.mockResolvedValue({ ...DETAIL, name: "Nome novo", description: "Nova descrição" });
    renderPage();

    await screen.findByRole("heading", { name: "Maratonadas" });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Nome novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("heading", { name: "Nome novo" })).toBeInTheDocument();
    expect(patchMock).toHaveBeenCalledWith("/api/series-lists/1", {
      name: "Nome novo",
      description: "Já vi tudo",
    });
  });

  it("remove a lista após confirmação e volta pra /listas", async () => {
    getMock.mockResolvedValue(DETAIL);
    deleteMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await screen.findByRole("heading", { name: "Maratonadas" });
    fireEvent.click(screen.getByRole("button", { name: "Remover lista" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/series-lists/1");
    expect(await screen.findByText("tela de listas")).toBeInTheDocument();
  });

  it("adiciona uma série à lista pela busca embutida na própria página", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/series-lists/1") return Promise.resolve(DETAIL);
      if (path.startsWith("/api/series/search")) {
        return Promise.resolve({
          results: [
            {
              tmdbId: 1398,
              name: "Better Call Saul",
              posterUrl: null,
              firstAirDate: null,
              genres: [],
              numberOfSeasons: null,
              numberOfEpisodes: null,
              rating: null,
            },
          ],
        });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    putMock.mockResolvedValue(undefined);

    renderPage();
    await screen.findByRole("heading", { name: "Maratonadas" });

    // Timers falsos só a partir daqui — o findBy acima usa polling real.
    vi.useFakeTimers();

    fireEvent.change(screen.getByLabelText("Buscar série pra adicionar à lista"), {
      target: { value: "better call saul" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });

    expect(putMock).toHaveBeenCalledWith("/api/series-lists/1/items/1398");
    expect(screen.getAllByText("Better Call Saul").length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});

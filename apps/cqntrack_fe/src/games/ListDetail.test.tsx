import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GamesApiError } from "../lib/games-client";
import { ListDetail } from "./ListDetail";

const { getMock, patchMock, deleteMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
}));

vi.mock("../lib/games-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/games-client")>("../lib/games-client");
  return {
    ...actual,
    gamesClient: { get: getMock, patch: patchMock, delete: deleteMock, put: putMock, post: vi.fn() },
  };
});

const DETAIL = {
  id: "1",
  name: "Quero jogar",
  description: "Backlog",
  itemCount: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  items: [
    {
      igdbId: 1942,
      name: "The Witcher 3: Wild Hunt",
      coverUrl: null,
      firstReleaseDate: "2015-05-19",
      platforms: [],
      genres: [],
      rating: null,
    },
  ],
};

function renderPage(initialEntry = "/jogos/listas/1") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/jogos/listas" element={<p>tela de listas</p>} />
        <Route path="/jogos/listas/:listId" element={<ListDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ListDetail", () => {
  beforeEach(() => {
    getMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    putMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mostra o nome, a descrição e os jogos da lista", async () => {
    getMock.mockResolvedValue(DETAIL);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Quero jogar" })).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();
  });

  it("mostra 'lista não encontrada' em 404", async () => {
    getMock.mockRejectedValue(new GamesApiError(404, "not found"));
    renderPage();

    expect(await screen.findByText("Lista não encontrada.")).toBeInTheDocument();
  });

  it("remove um jogo da lista", async () => {
    getMock.mockResolvedValue(DETAIL);
    deleteMock.mockResolvedValue(undefined);
    renderPage();

    await screen.findByText("The Witcher 3: Wild Hunt");
    fireEvent.click(screen.getByRole("button", { name: "Remover da lista" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/lists/1/items/1942");
    expect(await screen.findByText("Essa lista ainda não tem jogos.")).toBeInTheDocument();
  });

  it("edita nome e descrição pelo modal", async () => {
    getMock.mockResolvedValue(DETAIL);
    patchMock.mockResolvedValue({ ...DETAIL, name: "Nome novo", description: "Nova descrição" });
    renderPage();

    await screen.findByRole("heading", { name: "Quero jogar" });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Nome novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("heading", { name: "Nome novo" })).toBeInTheDocument();
    expect(patchMock).toHaveBeenCalledWith("/api/lists/1", {
      name: "Nome novo",
      description: "Backlog",
    });
  });

  it("remove a lista após confirmação e volta pra /listas", async () => {
    getMock.mockResolvedValue(DETAIL);
    deleteMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    await screen.findByRole("heading", { name: "Quero jogar" });
    fireEvent.click(screen.getByRole("button", { name: "Remover lista" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/lists/1");
    expect(await screen.findByText("tela de listas")).toBeInTheDocument();
  });

  it("adiciona um jogo à lista pela busca embutida na própria página", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/lists/1") return Promise.resolve(DETAIL);
      if (path.startsWith("/api/games/search")) {
        return Promise.resolve({
          results: [
            {
              igdbId: 802,
              name: "Celeste",
              coverUrl: null,
              firstReleaseDate: null,
              platforms: [],
              genres: [],
              rating: null,
            },
          ],
        });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    putMock.mockResolvedValue(undefined);

    renderPage();
    await screen.findByRole("heading", { name: "Quero jogar" });

    // Timers falsos só a partir daqui — o findBy acima usa polling real.
    vi.useFakeTimers();

    fireEvent.change(screen.getByLabelText("Buscar jogo pra adicionar à lista"), {
      target: { value: "celeste" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    });

    expect(putMock).toHaveBeenCalledWith("/api/lists/1/items/802");
    expect(screen.getAllByText("Celeste").length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});

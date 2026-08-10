import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { GameDetail } from "./GameDetail";
import { GamesApiError } from "../lib/games-client";

const { getMock, putMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../lib/games-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/games-client")>("../lib/games-client");
  return {
    ...actual,
    gamesClient: { get: getMock, put: putMock, delete: deleteMock, post: vi.fn(), patch: vi.fn() },
  };
});

const GAME = {
  igdbId: 1942,
  name: "The Witcher 3: Wild Hunt",
  coverUrl: null,
  firstReleaseDate: "2015-05-19",
  platforms: ["PC (Microsoft Windows)", "PS5"],
  genres: ["RPG"],
  rating: 92.7,
  summary: "Um bruxo caça monstros.",
};

function renderDetail() {
  render(
    <MemoryRouter initialEntries={["/jogos/1942"]}>
      <Routes>
        <Route path="/jogos/:igdbId" element={<GameDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GameDetail", () => {
  it("mostra os dados do jogo e a marcação existente", async () => {
    getMock.mockResolvedValue({
      game: GAME,
      entry: {
        id: "1",
        status: "playing",
        rating: 4.5,
        favorite: true,
        platform: "PS5",
        review: "Muito bom",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    renderDetail();

    expect(await screen.findByRole("heading", { name: "The Witcher 3: Wild Hunt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jogando" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "★ Favoritado" })).toBeInTheDocument();
    expect(screen.getByLabelText("Plataforma jogada")).toHaveValue("PS5");
    expect(screen.getByDisplayValue("Muito bom")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/games/1942");
  });

  it("salva a plataforma imediatamente ao selecionar", async () => {
    getMock.mockResolvedValue({
      game: GAME,
      entry: {
        id: "1",
        status: null,
        rating: null,
        favorite: false,
        platform: null,
        review: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    putMock.mockResolvedValue({
      id: "1",
      status: null,
      rating: null,
      favorite: false,
      platform: "PS5",
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderDetail();

    await screen.findByRole("heading", { name: "The Witcher 3: Wild Hunt" });
    fireEvent.change(screen.getByLabelText("Plataforma jogada"), { target: { value: "PS5" } });

    expect(putMock).toHaveBeenCalledWith("/api/games/1942/entry", { platform: "PS5" });
  });

  it("cria a marcação ao escolher um status quando ainda não existe entry", async () => {
    getMock.mockResolvedValue({ game: GAME, entry: null });
    putMock.mockResolvedValue({
      id: "2",
      status: "playing",
      rating: null,
      favorite: false,
      platform: null,
      review: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderDetail();

    await screen.findByRole("heading", { name: "The Witcher 3: Wild Hunt" });
    fireEvent.click(screen.getByRole("button", { name: "Jogando" }));

    expect(putMock).toHaveBeenCalledWith("/api/games/1942/entry", { status: "playing" });
    expect(await screen.findByRole("button", { name: "Jogando" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("remove a marcação existente", async () => {
    getMock.mockResolvedValue({
      game: GAME,
      entry: {
        id: "1",
        status: "playing",
        rating: null,
        favorite: false,
        platform: null,
        review: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    deleteMock.mockResolvedValue(undefined);
    renderDetail();

    await screen.findByRole("heading", { name: "The Witcher 3: Wild Hunt" });
    fireEvent.click(screen.getByRole("button", { name: "Remover marcação" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/games/1942/entry");
    expect(await screen.findByRole("button", { name: "☆ Favoritar" })).toBeInTheDocument();
  });

  it("mostra 'jogo não encontrado' quando a API retorna 404", async () => {
    getMock.mockRejectedValue(new GamesApiError(404, "not found"));
    renderDetail();

    expect(await screen.findByText("Jogo não encontrado.")).toBeInTheDocument();
  });

  it("mostra mensagem de erro genérica em outras falhas", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar o jogo");
  });
});

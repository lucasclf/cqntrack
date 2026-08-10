import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { GamesApiError } from "../lib/games-client";
import { PublicProfile } from "./PublicProfile";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/games-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/games-client")>("../lib/games-client");
  return { ...actual, gamesClient: { get: getMock, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

const PROFILE = {
  username: "gamer_1",
  displayUsername: "Gamer_1",
  memberSince: "2026-01-01T00:00:00.000Z",
  stats: { total: 2, completed: 1, playing: 1, platinum: 0, favorites: 1 },
};

const GAME = {
  igdbId: 1942,
  name: "The Witcher 3: Wild Hunt",
  coverUrl: null,
  firstReleaseDate: "2015-05-19",
  platforms: [],
  genres: [],
  rating: null,
};

function renderProfile(username = "gamer_1") {
  render(
    <MemoryRouter initialEntries={[`/u/${username}`]}>
      <Routes>
        <Route path="/u/:username" element={<PublicProfile />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicProfile", () => {
  it("mostra perfil, estatísticas, listas e marcações sem exigir sessão", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/users/gamer_1") return Promise.resolve(PROFILE);
      if (path === "/api/users/gamer_1/entries") {
        return Promise.resolve({
          items: [{ id: "1", status: "playing", rating: null, favorite: false, platform: null, review: null, updatedAt: "2026-01-01T00:00:00.000Z", game: GAME }],
          page: 1,
          pageSize: 24,
          total: 1,
        });
      }
      if (path === "/api/users/gamer_1/lists") {
        return Promise.resolve({ lists: [{ id: "l1", name: "Favoritos", description: null, itemCount: 3, createdAt: "", updatedAt: "" }] });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderProfile();

    expect(await screen.findByRole("heading", { name: "Gamer_1" })).toBeInTheDocument();
    expect(screen.getByText("@gamer_1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Listas" })).toBeInTheDocument();
    expect(screen.getByText("(3)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Favoritos/ })).toHaveAttribute(
      "href",
      "/u/gamer_1/listas/l1",
    );
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();
  });

  it("mostra 'usuário não encontrado' em 404", async () => {
    getMock.mockRejectedValue(new GamesApiError(404, "not found"));
    renderProfile("nao-existe");

    expect(await screen.findByText("Usuário não encontrado.")).toBeInTheDocument();
  });

  it("mostra erro genérico em outras falhas", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderProfile();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar o perfil");
  });
});

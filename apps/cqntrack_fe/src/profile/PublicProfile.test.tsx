import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { PublicProfile } from "./PublicProfile";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return { ...actual, apiClient: { get: getMock, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
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

const SERIES = {
  tmdbId: 1396,
  name: "Breaking Bad",
  posterUrl: null,
  firstAirDate: "2008-01-20",
  genres: [],
  numberOfSeasons: null,
  numberOfEpisodes: null,
  rating: null,
};

const EMPTY_SERIES_FAVORITES = {
  slots: [
    { slot: 1, entry: null },
    { slot: 2, entry: null },
    { slot: 3, entry: null },
    { slot: 4, entry: null },
  ],
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
      if (path === "/api/users/gamer_1/games/entries") {
        return Promise.resolve({
          items: [{ id: "1", status: "playing", rating: null, favoriteSlot: null, platforms: null, review: null, updatedAt: "2026-01-01T00:00:00.000Z", game: GAME }],
          page: 1,
          pageSize: 24,
          total: 1,
        });
      }
      if (path === "/api/users/gamer_1/games/lists") {
        return Promise.resolve({ lists: [{ id: "l1", name: "Favoritos", description: null, itemCount: 3, createdAt: "", updatedAt: "" }] });
      }
      if (path === "/api/users/gamer_1/games/favorites") {
        return Promise.resolve({
          slots: [
            { slot: 1, entry: null },
            { slot: 2, entry: null },
            { slot: 3, entry: null },
            { slot: 4, entry: null },
          ],
        });
      }
      if (path === "/api/users/gamer_1/series/entries") {
        return Promise.resolve({
          items: [
            {
              id: "1",
              status: "watching",
              rating: null,
              currentSeason: null,
              currentEpisode: null,
              favoriteSlot: null,
              review: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
              series: SERIES,
            },
          ],
          page: 1,
          pageSize: 24,
          total: 1,
        });
      }
      if (path === "/api/users/gamer_1/series/lists") {
        return Promise.resolve({
          lists: [{ id: "sl1", name: "Maratonadas", description: null, itemCount: 2, createdAt: "", updatedAt: "" }],
        });
      }
      if (path === "/api/users/gamer_1/series/favorites") {
        return Promise.resolve(EMPTY_SERIES_FAVORITES);
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

    // Seção de séries: marcações mostram, lista aparece SEM link (não existe
    // página pública de detalhe de lista de séries ainda).
    expect(screen.getByRole("heading", { name: "Marcações de séries" })).toBeInTheDocument();
    expect(screen.getByText("Breaking Bad")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Listas de séries" })).toBeInTheDocument();
    expect(screen.getByText("Maratonadas")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Maratonadas/ })).not.toBeInTheDocument();
  });

  it("mostra 'usuário não encontrado' em 404", async () => {
    getMock.mockRejectedValue(new ApiError(404, "not found"));
    renderProfile("nao-existe");

    expect(await screen.findByText("Usuário não encontrado.")).toBeInTheDocument();
  });

  it("mostra erro genérico em outras falhas", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderProfile();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar o perfil");
  });
});

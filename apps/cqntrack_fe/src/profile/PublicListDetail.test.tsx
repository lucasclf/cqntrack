import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { PublicListDetail } from "./PublicListDetail";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return { ...actual, apiClient: { get: getMock, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

const DETAIL = {
  id: "l1",
  name: "Backlog",
  description: "Jogos pra jogar",
  itemCount: 1,
  createdAt: "",
  updatedAt: "",
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

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/u/gamer_1/listas/l1"]}>
      <Routes>
        <Route path="/u/:username" element={<p>tela de perfil</p>} />
        <Route path="/u/:username/listas/:listId" element={<PublicListDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicListDetail", () => {
  it("mostra nome, descrição e jogos da lista, sem exigir sessão", async () => {
    getMock.mockResolvedValue(DETAIL);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Backlog" })).toBeInTheDocument();
    expect(screen.getByText("Jogos pra jogar")).toBeInTheDocument();
    expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/users/gamer_1/lists/l1");
  });

  it("mostra 'lista não encontrada' em 404", async () => {
    getMock.mockRejectedValue(new ApiError(404, "not found"));
    renderPage();

    expect(await screen.findByText("Lista não encontrada.")).toBeInTheDocument();
  });
});

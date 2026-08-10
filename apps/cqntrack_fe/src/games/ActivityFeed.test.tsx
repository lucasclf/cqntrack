import type { ActivityItem } from "@cqntrack/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityFeed } from "./ActivityFeed";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/games-client", () => ({
  gamesClient: { get: getMock },
}));

const GAME = {
  igdbId: 1942,
  name: "The Witcher 3: Wild Hunt",
  coverUrl: null,
  firstReleaseDate: "2015-05-19",
  platforms: [],
  genres: [],
  rating: null,
};

function renderFeed() {
  render(
    <MemoryRouter>
      <ActivityFeed />
    </MemoryRouter>,
  );
}

describe("ActivityFeed", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra mensagem quando não há atividade", async () => {
    getMock.mockResolvedValue({ items: [], nextCursor: null });
    renderFeed();

    expect(await screen.findByText(/Nenhuma atividade ainda/)).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderFeed();

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar sua atividade recente");
  });

  it("descreve cada tipo de atividade e linka pro jogo", async () => {
    const items: ActivityItem[] = [
      { id: "1", type: "status_changed", status: "playing", createdAt: "2026-01-01T10:00:00.000Z", game: GAME },
      { id: "2", type: "rated", rating: 4.5, createdAt: "2026-01-01T09:00:00.000Z", game: GAME },
      { id: "3", type: "favorited", createdAt: "2026-01-01T08:00:00.000Z", game: GAME },
      { id: "4", type: "reviewed", createdAt: "2026-01-01T07:00:00.000Z", game: GAME },
      {
        id: "5",
        type: "added_to_list",
        listId: "l1",
        listName: "Favoritos",
        createdAt: "2026-01-01T06:00:00.000Z",
        game: GAME,
      },
    ];
    getMock.mockResolvedValue({ items, nextCursor: null });
    renderFeed();

    expect(await screen.findByText('Marcou como "Jogando"')).toBeInTheDocument();
    expect(screen.getByText("Avaliou com 4.5 estrelas")).toBeInTheDocument();
    expect(screen.getByText("Favoritou")).toBeInTheDocument();
    expect(screen.getByText("Escreveu uma review")).toBeInTheDocument();
    expect(screen.getByText('Adicionou à lista "Favoritos"')).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /The Witcher 3/ })[0]).toHaveAttribute(
      "href",
      "/jogos/1942",
    );
  });

  it("carrega mais itens ao clicar em 'Carregar mais'", async () => {
    getMock.mockResolvedValueOnce({
      items: [{ id: "1", type: "favorited", createdAt: "2026-01-01T10:00:00.000Z", game: GAME }],
      nextCursor: "2026-01-01T10:00:00.000Z",
    });
    renderFeed();

    await screen.findByText("Favoritou");
    getMock.mockResolvedValueOnce({
      items: [{ id: "2", type: "reviewed", createdAt: "2026-01-01T09:00:00.000Z", game: GAME }],
      nextCursor: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("Escreveu uma review")).toBeInTheDocument();
    expect(getMock).toHaveBeenLastCalledWith(
      `/api/activity?before=${encodeURIComponent("2026-01-01T10:00:00.000Z")}`,
    );
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });
});

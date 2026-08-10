import type { ActivityItem } from "@cqntrack/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityFeed } from "./ActivityFeed";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/games-client", () => ({
  gamesClient: { get: getMock },
}));

const GAME_SNAPSHOT = {
  mediaType: "games" as const,
  itemId: "1942",
  itemTitle: "The Witcher 3: Wild Hunt",
  itemHref: "/jogos/1942",
  itemCoverUrl: null,
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
      {
        id: "1",
        type: "status_changed",
        metadata: { status: "playing" },
        createdAt: "2026-01-01T10:00:00.000Z",
        ...GAME_SNAPSHOT,
      },
      {
        id: "2",
        type: "rated",
        metadata: { rating: 4.5 },
        createdAt: "2026-01-01T09:00:00.000Z",
        ...GAME_SNAPSHOT,
      },
      { id: "3", type: "favorited", metadata: null, createdAt: "2026-01-01T08:00:00.000Z", ...GAME_SNAPSHOT },
      { id: "4", type: "reviewed", metadata: null, createdAt: "2026-01-01T07:00:00.000Z", ...GAME_SNAPSHOT },
      {
        id: "5",
        type: "added_to_list",
        metadata: { listId: "l1", listName: "Favoritos" },
        createdAt: "2026-01-01T06:00:00.000Z",
        ...GAME_SNAPSHOT,
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
      items: [
        { id: "1", type: "favorited", metadata: null, createdAt: "2026-01-01T10:00:00.000Z", ...GAME_SNAPSHOT },
      ],
      nextCursor: "2026-01-01T10:00:00.000Z",
    });
    renderFeed();

    await screen.findByText("Favoritou");
    getMock.mockResolvedValueOnce({
      items: [
        { id: "2", type: "reviewed", metadata: null, createdAt: "2026-01-01T09:00:00.000Z", ...GAME_SNAPSHOT },
      ],
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

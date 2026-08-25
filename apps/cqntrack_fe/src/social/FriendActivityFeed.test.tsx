import type { FriendActivityItem } from "@cqntrack/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendActivityFeed } from "./FriendActivityFeed";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
}));

const ITEM: FriendActivityItem = {
  id: "1",
  mediaType: "games",
  itemId: "1942",
  itemTitle: "The Witcher 3: Wild Hunt",
  itemHref: "/jogos/1942",
  itemCoverUrl: null,
  type: "favorited",
  metadata: null,
  createdAt: "2026-01-01T10:00:00.000Z",
  author: { username: "amigo1", displayUsername: "Amigo Um", image: null },
};

function renderFeed() {
  render(
    <MemoryRouter>
      <FriendActivityFeed />
    </MemoryRouter>,
  );
}

describe("FriendActivityFeed", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("mostra mensagem quando não há atividade de amigos", async () => {
    getMock.mockResolvedValue({ items: [], nextCursor: null });
    renderFeed();

    expect(await screen.findByText(/Nenhuma atividade por aqui ainda/)).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderFeed();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao carregar a atividade dos seus amigos",
    );
  });

  it("mostra o autor de cada item, linkando pro perfil dele, e o item em si", async () => {
    getMock.mockResolvedValue({ items: [ITEM], nextCursor: null });
    renderFeed();

    expect(await screen.findByText("Amigo Um")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Amigo Um/ })).toHaveAttribute("href", "/@amigo1");
    expect(screen.getByText("Favoritou")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /The Witcher 3/ })).toHaveAttribute(
      "href",
      "/jogos/1942",
    );
  });

  it("carrega mais itens ao clicar em 'Carregar mais'", async () => {
    getMock.mockResolvedValueOnce({
      items: [ITEM],
      nextCursor: "2026-01-01T10:00:00.000Z",
    });
    renderFeed();

    await screen.findByText("Favoritou");
    getMock.mockResolvedValueOnce({
      items: [
        {
          ...ITEM,
          id: "2",
          type: "reviewed",
          author: { username: "amigo2", displayUsername: "Amigo Dois", image: null },
        },
      ],
      nextCursor: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("Amigo Dois")).toBeInTheDocument();
    expect(getMock).toHaveBeenLastCalledWith(
      `/api/social/feed?before=${encodeURIComponent("2026-01-01T10:00:00.000Z")}`,
    );
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });
});

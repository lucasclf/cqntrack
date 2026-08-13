import type { ActivityItem } from "@cqntrack/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityFeed } from "./ActivityFeed";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock },
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

    expect(await screen.findByText(/Nenhuma atividade por aqui ainda/)).toBeInTheDocument();
  });

  it("mostra erro quando a busca falha", async () => {
    getMock.mockRejectedValue(new Error("falha de rede"));
    renderFeed();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao carregar sua atividade recente",
    );
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
      {
        id: "3",
        type: "favorited",
        metadata: null,
        createdAt: "2026-01-01T08:00:00.000Z",
        ...GAME_SNAPSHOT,
      },
      {
        id: "4",
        type: "reviewed",
        metadata: null,
        createdAt: "2026-01-01T07:00:00.000Z",
        ...GAME_SNAPSHOT,
      },
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

  it("descreve a atividade 'status_changed' de filme com o rótulo de status de filme", async () => {
    const items: ActivityItem[] = [
      {
        id: "1",
        type: "status_changed",
        metadata: { status: "watched" },
        createdAt: "2026-01-01T10:00:00.000Z",
        mediaType: "movies",
        itemId: "27205",
        itemTitle: "Inception",
        itemHref: "/filmes/27205",
        itemCoverUrl: null,
      },
    ];
    getMock.mockResolvedValue({ items, nextCursor: null });
    renderFeed();

    // "watched" (Já vi) é rótulo de filme, diferente de "playing" (Jogando)
    // de jogo — confirma que o mapa certo foi escolhido por mediaType (bug
    // real encontrado ao testar a aba Atividades: caía no mapa de jogo e
    // mostrava "Marcou como \"undefined\"").
    expect(await screen.findByText('Marcou como "Já vi"')).toBeInTheDocument();
  });

  it("descreve a atividade 'watched' de filme", async () => {
    const items: ActivityItem[] = [
      {
        id: "1",
        type: "watched",
        metadata: null,
        createdAt: "2026-01-01T10:00:00.000Z",
        mediaType: "movies",
        itemId: "27205",
        itemTitle: "Inception",
        itemHref: "/filmes/27205",
        itemCoverUrl: null,
      },
    ];
    getMock.mockResolvedValue({ items, nextCursor: null });
    renderFeed();

    expect(await screen.findByText("Assistiu")).toBeInTheDocument();
  });

  it("descreve a atividade 'status_changed' de livro com o rótulo de status de livro", async () => {
    const items: ActivityItem[] = [
      {
        id: "1",
        type: "status_changed",
        metadata: { status: "reading" },
        createdAt: "2026-01-01T10:00:00.000Z",
        mediaType: "books",
        itemId: "PCq3AAAAQBAJ",
        itemTitle: "Dom Casmurro",
        itemHref: "/livros/PCq3AAAAQBAJ",
        itemCoverUrl: null,
      },
    ];
    getMock.mockResolvedValue({ items, nextCursor: null });
    renderFeed();

    // "reading" (Lendo) é rótulo de livro, diferente de "playing" (Jogando)
    // de jogo — confirma que o mapa certo foi escolhido por mediaType.
    expect(await screen.findByText('Marcou como "Lendo"')).toBeInTheDocument();
  });

  it("carrega mais itens ao clicar em 'Carregar mais'", async () => {
    getMock.mockResolvedValueOnce({
      items: [
        {
          id: "1",
          type: "favorited",
          metadata: null,
          createdAt: "2026-01-01T10:00:00.000Z",
          ...GAME_SNAPSHOT,
        },
      ],
      nextCursor: "2026-01-01T10:00:00.000Z",
    });
    renderFeed();

    await screen.findByText("Favoritou");
    getMock.mockResolvedValueOnce({
      items: [
        {
          id: "2",
          type: "reviewed",
          metadata: null,
          createdAt: "2026-01-01T09:00:00.000Z",
          ...GAME_SNAPSHOT,
        },
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

  it("com mediaType, filtra a busca inicial e o 'carregar mais'", async () => {
    getMock.mockResolvedValueOnce({
      items: [
        {
          id: "1",
          type: "favorited",
          metadata: null,
          createdAt: "2026-01-01T10:00:00.000Z",
          ...GAME_SNAPSHOT,
        },
      ],
      nextCursor: "2026-01-01T10:00:00.000Z",
    });
    render(
      <MemoryRouter>
        <ActivityFeed mediaType="games" />
      </MemoryRouter>,
    );

    await screen.findByText("Favoritou");
    expect(getMock).toHaveBeenCalledWith("/api/activity?mediaType=games");

    getMock.mockResolvedValueOnce({ items: [], nextCursor: null });
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    await waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith(
        `/api/activity?before=${encodeURIComponent("2026-01-01T10:00:00.000Z")}&mediaType=games`,
      ),
    );
  });
});

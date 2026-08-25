import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { FriendsPage } from "./FriendsPage";

const { getMock, putMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../lib/api-client")>("../lib/api-client");
  return {
    ...actual,
    apiClient: { get: getMock, post: vi.fn(), put: putMock, patch: vi.fn(), delete: deleteMock },
  };
});

const FOLLOWED = {
  username: "amigo1",
  displayUsername: "Amigo Um",
  image: null,
};

function renderPage() {
  render(
    <MemoryRouter>
      <FriendsPage />
    </MemoryRouter>,
  );
}

function mockFeedEmpty() {
  return { items: [], nextCursor: null };
}

describe("FriendsPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockImplementation((path: string) => {
      if (path === "/api/social/feed") return Promise.resolve(mockFeedEmpty());
      if (path === "/api/social/following") return Promise.resolve({ items: [] });
      return Promise.reject(new Error("rota inesperada: " + path));
    });
  });

  it("mostra quem eu sigo", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/social/feed") return Promise.resolve(mockFeedEmpty());
      if (path === "/api/social/following") return Promise.resolve({ items: [FOLLOWED] });
      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderPage();

    expect(await screen.findByText("Amigo Um")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Amigo Um/ })).toHaveAttribute("href", "/@amigo1");
  });

  it("mensagem quando não segue ninguém", async () => {
    renderPage();

    expect(await screen.findByText("Você ainda não segue ninguém.")).toBeInTheDocument();
  });

  it("deixar de seguir remove da lista", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/social/feed") return Promise.resolve(mockFeedEmpty());
      if (path === "/api/social/following") return Promise.resolve({ items: [FOLLOWED] });
      return Promise.reject(new Error("rota inesperada: " + path));
    });
    deleteMock.mockResolvedValue(undefined);

    renderPage();
    await screen.findByText("Amigo Um");

    fireEvent.click(screen.getByRole("button", { name: "Deixar de seguir" }));

    expect(deleteMock).toHaveBeenCalledWith("/api/social/follow/amigo1");
    await waitFor(() => {
      expect(screen.queryByText("Amigo Um")).not.toBeInTheDocument();
    });
  });

  it("buscar por username e seguir recarrega a lista e o feed", async () => {
    putMock.mockResolvedValue(undefined);
    let followingCalls = 0;
    let feedCalls = 0;
    getMock.mockImplementation((path: string) => {
      if (path === "/api/social/feed") {
        feedCalls += 1;
        return Promise.resolve(mockFeedEmpty());
      }
      if (path === "/api/social/following") {
        followingCalls += 1;
        return Promise.resolve({ items: followingCalls > 1 ? [FOLLOWED] : [] });
      }
      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderPage();
    await screen.findByText("Você ainda não segue ninguém.");
    // Feed do FriendActivityFeed já buscou 1x no mount inicial (bug real
    // encontrado ao testar ao vivo: seguir alguém não atualizava o feed
    // porque ele só busca on-mount — ver `feedRefreshKey` em FriendsPage).
    const feedCallsBeforeFollow = feedCalls;

    fireEvent.change(screen.getByPlaceholderText("Username de quem você quer seguir"), {
      target: { value: "amigo1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }));

    expect(await screen.findByText("Amigo Um")).toBeInTheDocument();
    expect(putMock).toHaveBeenCalledWith("/api/social/follow/amigo1");
    await waitFor(() => {
      expect(feedCalls).toBeGreaterThan(feedCallsBeforeFollow);
    });
  });

  it("username inexistente mostra mensagem de erro", async () => {
    putMock.mockRejectedValue(new ApiError(404, "not found"));

    renderPage();
    await screen.findByText("Você ainda não segue ninguém.");

    fireEvent.change(screen.getByPlaceholderText("Username de quem você quer seguir"), {
      target: { value: "ninguem" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Usuário não encontrado.");
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchUsers } from "./SearchUsers";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("../lib/api-client", () => ({
  apiClient: { get: getMock, put: vi.fn(), delete: vi.fn() },
}));

vi.mock("../lib/auth-client", () => ({
  authClient: { useSession: useSessionMock },
}));

function renderSearchUsers() {
  render(
    <MemoryRouter>
      <SearchUsers />
    </MemoryRouter>,
  );
}

describe("SearchUsers", () => {
  beforeEach(() => {
    getMock.mockReset();
    useSessionMock.mockReset();
    useSessionMock.mockReturnValue({ data: { user: { username: "eu" } } });
  });

  it("sem digitar nada, já busca e mostra o diretório de usuários", async () => {
    getMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/social/search")) {
        return Promise.resolve({
          items: [{ username: "amigo1", displayUsername: "Amigo Um", image: null }],
          page: 1,
          pageSize: 20,
          total: 1,
        });
      }
      if (path.includes("/status")) return Promise.resolve({ following: false });
      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderSearchUsers();

    expect(await screen.findByText("Amigo Um")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/social\/search\?page=1&pageSize=20$/),
    );
  });

  it("digitar filtra por texto (debounced) e cada resultado tem o FollowButton", async () => {
    getMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/social/search")) {
        if (path.includes("q=alice")) {
          return Promise.resolve({
            items: [{ username: "alice", displayUsername: "Alice", image: null }],
            page: 1,
            pageSize: 20,
            total: 1,
          });
        }
        return Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0 });
      }
      if (path.includes("/status")) return Promise.resolve({ following: false });
      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderSearchUsers();
    await screen.findByText("Nenhum usuário encontrado.");

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar usuários" }), {
      target: { value: "alice" },
    });

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Seguir" })).toBeInTheDocument();
  });

  it("'Carregar mais' busca a próxima página", async () => {
    getMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/social/search")) {
        if (path.includes("page=2")) {
          return Promise.resolve({
            items: [{ username: "bob", displayUsername: "Bob", image: null }],
            page: 2,
            pageSize: 20,
            total: 2,
          });
        }
        return Promise.resolve({
          items: [{ username: "alice", displayUsername: "Alice", image: null }],
          page: 1,
          pageSize: 20,
          total: 2,
        });
      }
      if (path.includes("/status")) return Promise.resolve({ following: false });
      return Promise.reject(new Error("rota inesperada: " + path));
    });

    renderSearchUsers();
    await screen.findByText("Alice");

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
    });
  });
});
